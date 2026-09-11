import { inflateRawSync } from "node:zlib";

import {
  GuestEventState,
  GuestImportRowState,
  GuestImportState,
  JobState,
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import { writeAuditEvent } from "@/modules/audit";
import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";
import { getInvitationLifecycleCapabilities } from "@/modules/lifecycle";
import { ownerMembershipWhere } from "@/modules/invitations/authorization";

import { INVITED_PEOPLE_LIMIT, sumPartySizes } from "./capacity";
import { normalizeGuestName, normalizePhone } from "./normalization";

export const GUEST_IMPORT_PARSE_JOB = "GUEST_IMPORT_PARSE";
export const GUEST_IMPORT_COMMIT_JOB = "GUEST_IMPORT_COMMIT";
export const DEFAULT_GUEST_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_GUEST_IMPORT_MAX_ROWS = 10_000;
export const DEFAULT_GUEST_IMPORT_COMMIT_BATCH_SIZE = 50;

export interface GuestImportLimits {
  readonly maxFileBytes: number;
  readonly maxRows: number;
  readonly commitBatchSize: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getGuestImportLimits(environment: Record<string, string | undefined> = process.env): GuestImportLimits {
  return {
    maxFileBytes: positiveInteger(environment.GUEST_IMPORT_MAX_FILE_BYTES, DEFAULT_GUEST_IMPORT_MAX_FILE_BYTES),
    maxRows: positiveInteger(environment.GUEST_IMPORT_MAX_ROWS, DEFAULT_GUEST_IMPORT_MAX_ROWS),
    commitBatchSize: Math.min(500, positiveInteger(environment.GUEST_IMPORT_COMMIT_BATCH_SIZE, DEFAULT_GUEST_IMPORT_COMMIT_BATCH_SIZE)),
  };
}

export type GuestImportIssueCode = "REQUIRED" | "INVALID_PHONE" | "INVALID_PARTY_SIZE" | "EVENT_NOT_FOUND" | "EVENT_REQUIRED" | "FORMAT";

export interface GuestImportIssue {
  readonly code: GuestImportIssueCode | string;
  readonly field?: string;
  readonly message: string;
}

export interface GuestImportDuplicateWarning {
  readonly guestId?: string;
  readonly displayName: string;
  readonly matchingSignals: readonly ("PHONE" | "NAME")[];
}

export interface GuestImportAssignment {
  readonly eventId: string;
  readonly maxPartySize: number;
}

export interface ParsedGuestImportRow {
  readonly rowNumber: number;
  readonly rawValues: Readonly<Record<string, string>>;
  readonly displayName: string;
  readonly phone: string;
  readonly groupName: string;
  readonly eventNames: readonly string[];
  readonly maxPartySize: number | null;
}

export interface ValidatedGuestImportRow {
  readonly rowNumber: number;
  readonly rawValues: Readonly<Record<string, string>>;
  readonly displayName: string | null;
  readonly phone: string | null;
  readonly groupName: string | null;
  readonly assignments: readonly GuestImportAssignment[];
  readonly issues: readonly GuestImportIssue[];
  readonly duplicateWarnings: readonly GuestImportDuplicateWarning[];
  readonly isValid: boolean;
  readonly hasWarnings: boolean;
}

export class GuestImportInputError extends Error {
  readonly code: "FILE_TOO_LARGE" | "UNSUPPORTED_FILE_TYPE" | "ROW_LIMIT_EXCEEDED" | "INVALID_FILE";

  constructor(code: GuestImportInputError["code"], message: string) {
    super(message);
    this.name = "GuestImportInputError";
    this.code = code;
  }
}

const HEADER_ALIASES: Record<string, "displayName" | "phone" | "groupName" | "event" | "maxPartySize"> = {
  nama: "displayName",
  namatamu: "displayName",
  addressee: "displayName",
  penerima: "displayName",
  guest: "displayName",
  tamu: "displayName",
  name: "displayName",
  telepon: "phone",
  nomor: "phone",
  nomortelepon: "phone",
  nomorwa: "phone",
  whatsapp: "phone",
  phone: "phone",
  grup: "groupName",
  group: "groupName",
  kategori: "groupName",
  acara: "event",
  event: "event",
  events: "event",
  maxorang: "maxPartySize",
  maxpeople: "maxPartySize",
  jumlahorang: "maxPartySize",
  kapasitas: "maxPartySize",
  partysize: "maxPartySize",
  maxpartysize: "maxPartySize",
  max: "maxPartySize",
};

function normalizeHeader(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("id-ID").replace(/[^\p{L}\p{N}]+/gu, "");
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === "," || character === "\t") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  if (quoted) throw new GuestImportInputError("INVALID_FILE", "File CSV memiliki kutip yang tidak lengkap.");
  return rows;
}

interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
}

function zipEntries(bytes: Uint8Array): ZipEntry[] {
  const buffer = Buffer.from(bytes);
  const endOfCentralDirectory = 0x06054b50;
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65_557); index -= 1) {
    if (buffer.readUInt32LE(index) === endOfCentralDirectory) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new GuestImportInputError("INVALID_FILE", "File Excel tidak valid.");
  const count = buffer.readUInt16LE(eocd + 10);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  let offset = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new GuestImportInputError("INVALID_FILE", "File Excel tidak valid.");
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (name.endsWith("/")) {
      offset += 46 + nameLength + extraLength + commentLength;
      continue;
    }
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new GuestImportInputError("INVALID_FILE", "File Excel tidak valid.");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(start, start + compressedSize);
    let data: Uint8Array;
    if (compression === 0) data = compressed;
    else if (compression === 8) data = inflateRawSync(compressed);
    else throw new GuestImportInputError("INVALID_FILE", "Jenis kompresi Excel tidak didukung.");
    entries.push({ name, data });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function parseXlsx(bytes: Uint8Array): string[][] {
  const files = new Map(zipEntries(bytes).map((entry) => [entry.name, Buffer.from(entry.data).toString("utf8")]));
  const sheetName = [...files.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  const sheet = sheetName ? files.get(sheetName) : undefined;
  if (!sheet) throw new GuestImportInputError("INVALID_FILE", "Sheet Excel tidak ditemukan.");
  const sharedStrings = (files.get("xl/sharedStrings.xml")?.match(/<si\b[\s\S]*?<\/si>/g) ?? []).map((item) =>
    [...item.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join(""),
  );
  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1];
      const reference = attributes.match(/\br="([A-Z]+)\d+"/i)?.[1]?.toUpperCase();
      if (!reference) continue;
      let column = 0;
      for (const character of reference) column = column * 26 + character.charCodeAt(0) - 64;
      const type = attributes.match(/\bt="([^"]+)"/)?.[1];
      const contents = cellMatch[2];
      const value = decodeXml(contents.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? contents.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "");
      row[column - 1] = type === "s" ? (sharedStrings[Number(value)] ?? "") : value;
    }
    if (row.some((value) => value?.trim())) rows.push(row.map((value) => value ?? ""));
  }
  return rows;
}

function toRowRecords(rows: string[][]): ParsedGuestImportRow[] {
  const [headers, ...dataRows] = rows;
  if (!headers || headers.length === 0) throw new GuestImportInputError("INVALID_FILE", "Header file import belum tersedia.");
  const columns = headers.map((header) => HEADER_ALIASES[normalizeHeader(header)]);
  if (!columns.includes("displayName")) throw new GuestImportInputError("INVALID_FILE", "Kolom nama/addressee wajib tersedia.");
  return dataRows.map((values, index) => {
    const rawValues: Record<string, string> = {};
    headers.forEach((header, headerIndex) => { rawValues[header.trim() || `Kolom ${headerIndex + 1}`] = (values[headerIndex] ?? "").trim(); });
    const get = (column: typeof columns[number]): string => {
      const columnIndex = columns.indexOf(column);
      return columnIndex >= 0 ? (values[columnIndex] ?? "").trim() : "";
    };
    return {
      rowNumber: index + 2,
      rawValues,
      displayName: get("displayName"),
      phone: get("phone"),
      groupName: get("groupName"),
      eventNames: get("event").split(/[;,|]/).map((value) => value.trim()).filter(Boolean),
      maxPartySize: get("maxPartySize") ? Number(get("maxPartySize").replace(/[^\d.-]/g, "")) : 1,
    };
  });
}

export function parseGuestImportFile(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
  limits: GuestImportLimits = getGuestImportLimits(),
): ParsedGuestImportRow[] {
  if (bytes.byteLength > limits.maxFileBytes) throw new GuestImportInputError("FILE_TOO_LARGE", `Ukuran file maksimal ${limits.maxFileBytes} byte.`);
  const extension = filename.toLocaleLowerCase().split(".").pop();
  let rows: string[][];
  try {
    if (extension === "csv" || extension === "tsv" || mimeType.includes("csv") || mimeType.includes("tab-separated")) rows = parseCsv(new TextDecoder().decode(bytes));
    else if (extension === "xlsx" || mimeType.includes("spreadsheet") || mimeType.includes("excel")) rows = parseXlsx(bytes);
    else throw new GuestImportInputError("UNSUPPORTED_FILE_TYPE", "Pilih file CSV atau Excel (.xlsx).");
  } catch (error) {
    if (error instanceof GuestImportInputError) throw error;
    throw new GuestImportInputError("INVALID_FILE", "File import tidak dapat dibaca.");
  }
  const parsedRows = toRowRecords(rows);
  if (parsedRows.length > limits.maxRows) throw new GuestImportInputError("ROW_LIMIT_EXCEEDED", `Jumlah baris maksimal ${limits.maxRows}.`);
  return parsedRows;
}

interface ImportEvent {
  readonly id: string;
  readonly name: string;
}

interface ImportGuest {
  readonly id: string;
  readonly displayName: string;
  readonly normalizedName: string;
  readonly normalizedPhone: string | null;
}

function parsePartySize(value: number | null): number | null {
  return value !== null && Number.isSafeInteger(value) && value >= 1 && value <= INVITED_PEOPLE_LIMIT ? value : null;
}

export function validateGuestImportRows(
  rows: readonly ParsedGuestImportRow[],
  events: readonly ImportEvent[],
  existingGuests: readonly ImportGuest[],
): ValidatedGuestImportRow[] {
  const validated: ValidatedGuestImportRow[] = [];
  for (const row of rows) {
    const issues: GuestImportIssue[] = [];
    const displayName = row.displayName.trim() || null;
    if (!displayName) issues.push({ code: "REQUIRED", field: "displayName", message: "Nama tamu wajib diisi." });
    else if (displayName.length > 160) issues.push({ code: "REQUIRED", field: "displayName", message: "Nama tamu maksimal 160 karakter." });
    let phone: string | null = null;
    if (row.phone) {
      try { phone = normalizePhone(row.phone); } catch { issues.push({ code: "INVALID_PHONE", field: "phone", message: "Nomor telepon tidak valid." }); }
    }
    const partySize = parsePartySize(row.maxPartySize);
    if (partySize === null) issues.push({ code: "INVALID_PARTY_SIZE", field: "maxPartySize", message: "Maksimal orang harus berupa angka 1 sampai 500." });
    if (row.eventNames.length === 0) issues.push({ code: "EVENT_REQUIRED", field: "event", message: "Minimal satu acara wajib dipilih." });
    const assignments: GuestImportAssignment[] = [];
    for (const eventName of row.eventNames) {
      const normalizedEventName = normalizeGuestName(eventName);
      const event = events.find((candidate) => normalizeGuestName(candidate.name) === normalizedEventName);
      if (!event || partySize === null) {
        if (!event) issues.push({ code: "EVENT_NOT_FOUND", field: "event", message: `Acara “${eventName}” tidak ditemukan.` });
      } else if (!assignments.some((assignment) => assignment.eventId === event.id)) assignments.push({ eventId: event.id, maxPartySize: partySize });
    }
    const normalizedName = displayName ? normalizeGuestName(displayName) : "";
    const duplicateWarnings: GuestImportDuplicateWarning[] = [];
    for (const candidate of [...existingGuests, ...validated.filter((item) => item.isValid && item.displayName).map((item) => ({ id: undefined, displayName: item.displayName!, normalizedName: normalizeGuestName(item.displayName!), normalizedPhone: item.phone }))]) {
      const matchingSignals = [
        ...(phone && candidate.normalizedPhone === phone ? ["PHONE" as const] : []),
        ...(normalizedName && candidate.normalizedName === normalizedName ? ["NAME" as const] : []),
      ];
      if (matchingSignals.length > 0) duplicateWarnings.push({ guestId: candidate.id, displayName: candidate.displayName, matchingSignals });
    }
    validated.push({
      rowNumber: row.rowNumber,
      rawValues: row.rawValues,
      displayName,
      phone,
      groupName: row.groupName || null,
      assignments,
      issues,
      duplicateWarnings,
      isValid: issues.length === 0,
      hasWarnings: duplicateWarnings.length > 0,
    });
  }
  return validated;
}

function safeArray(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function jsonValue(value: unknown): Prisma.InputJsonValue { return value as Prisma.InputJsonValue; }

export interface GuestImportStartInput {
  readonly filename: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

export interface GuestImportStartResult { readonly importId: string; readonly state: GuestImportState; }

type ImportDatabase = Pick<PrismaClient, "$transaction" | "guestImport" | "job">;

function safeFilename(value: string): string {
  return value.split(/[\\/]/).pop()?.trim().slice(0, 180) || "guest-import";
}

function assertEditable(invitation: { commercialState: Parameters<typeof getInvitationLifecycleCapabilities>[0]; trialEndsAt: Date; activeUntil: Date | null }, now: Date): void {
  if (!getInvitationLifecycleCapabilities(invitation.commercialState, invitation.trialEndsAt, now, invitation.activeUntil).canEdit) throw new DomainError(ERROR_CODES.LIFECYCLE_LOCKED);
}

export async function startGuestImport(
  database: ImportDatabase,
  userId: string,
  invitationId: string,
  input: GuestImportStartInput,
  options: { readonly now?: () => Date; readonly limits?: GuestImportLimits } = {},
): Promise<GuestImportStartResult> {
  const limits = options.limits ?? getGuestImportLimits();
  const bytes = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);
  if (bytes.byteLength === 0) throw new GuestImportInputError("INVALID_FILE", "Pilih file import terlebih dahulu.");
  if (bytes.byteLength > limits.maxFileBytes) throw new GuestImportInputError("FILE_TOO_LARGE", `Ukuran file maksimal ${limits.maxFileBytes} byte.`);
  const now = options.now?.() ?? new Date();
  const filename = safeFilename(input.filename);
  return database.$transaction(async (transaction) => {
    const invitation = await transaction.invitation.findFirst({ where: { id: invitationId, ...ownerMembershipWhere(userId) }, select: { id: true, commercialState: true, trialEndsAt: true, activeUntil: true } });
    if (!invitation) throw new DomainError(ERROR_CODES.NOT_FOUND);
    assertEditable(invitation, now);
    const guestImport = await transaction.guestImport.create({
      data: { invitationId, requestedById: userId, sourceFilename: filename, sourceMimeType: input.mimeType.slice(0, 160), sourceSizeBytes: bytes.byteLength, sourceBytes: Buffer.from(bytes) },
      select: { id: true, state: true },
    });
    await transaction.job.create({ data: { type: GUEST_IMPORT_PARSE_JOB, dedupKey: `guest-import:parse:${guestImport.id}`, payload: { guestImportId: guestImport.id } } });
    return { importId: guestImport.id, state: guestImport.state };
  });
}

async function parseQueuedImport(database: ImportDatabase, importId: string, limits: GuestImportLimits): Promise<void> {
  const source = await database.$transaction(async (transaction) => {
    const guestImport = await transaction.guestImport.findUnique({ where: { id: importId }, select: { id: true, invitationId: true, sourceFilename: true, sourceMimeType: true, sourceBytes: true, state: true } });
    if (!guestImport || guestImport.state !== GuestImportState.PARSING || !guestImport.sourceBytes) throw new DomainError(ERROR_CODES.NOT_FOUND);
    const [events, guests] = await Promise.all([
      transaction.event.findMany({ where: { invitationId: guestImport.invitationId, archivedAt: null }, select: { id: true, name: true } }),
      transaction.guest.findMany({ where: { invitationId: guestImport.invitationId, archivedAt: null }, select: { id: true, displayName: true, normalizedName: true, normalizedPhone: true } }),
    ]);
    return { ...guestImport, bytes: guestImport.sourceBytes, events, guests };
  });
  const parsed = parseGuestImportFile(source.bytes, source.sourceFilename, source.sourceMimeType, limits);
  const rows = validateGuestImportRows(parsed, source.events, source.guests);
  const capacityBefore = await database.$transaction(async (transaction) => {
    const aggregate = await transaction.guestEvent.aggregate({ where: { state: GuestEventState.ACTIVE, guest: { invitationId: source.invitationId, archivedAt: null } }, _sum: { maxPartySize: true } });
    return aggregate._sum.maxPartySize ?? 0;
  });
  await database.$transaction(async (transaction) => {
    await transaction.guestImportRow.createMany({ data: rows.map((row) => ({ guestImportId: importId, rowNumber: row.rowNumber, displayName: row.displayName, phone: row.phone, groupName: row.groupName, assignments: jsonValue(row.assignments), rawValues: jsonValue(row.rawValues), issues: jsonValue(row.issues), duplicateWarnings: jsonValue(row.duplicateWarnings), isValid: row.isValid, hasWarnings: row.hasWarnings, state: row.isValid ? GuestImportRowState.INCLUDED : GuestImportRowState.EXCLUDED })) });
    const validRows = rows.filter((row) => row.isValid);
    const warningRows = rows.filter((row) => row.hasWarnings);
    const capacityAdditional = validRows.reduce((total, row) => total + sumPartySizes(row.assignments), 0);
    await transaction.guestImport.update({ where: { id: importId }, data: { state: GuestImportState.PREVIEW, sourceBytes: null, totalRows: rows.length, validRows: validRows.length, warningRows: warningRows.length, invalidRows: rows.length - validRows.length, includedRows: validRows.length, capacityBefore, capacityAdditional, capacityAfter: capacityBefore + capacityAdditional } });
  });
}

async function confirmGuestImport(
  database: ImportDatabase,
  userId: string,
  importId: string,
  options: { readonly now?: () => Date } = {},
): Promise<void> {
  const now = options.now?.() ?? new Date();
  await database.$transaction(async (transaction) => {
    const guestImport = await transaction.guestImport.findFirst({ where: { id: importId, invitation: ownerMembershipWhere(userId) }, select: { id: true, state: true, invitationId: true, invitation: { select: { id: true, version: true, commercialState: true, trialEndsAt: true, activeUntil: true } }, rows: { where: { state: GuestImportRowState.INCLUDED, isValid: true }, select: { assignments: true } } } });
    if (!guestImport) throw new DomainError(ERROR_CODES.NOT_FOUND);
    if (guestImport.state !== GuestImportState.PREVIEW) throw new DomainError(ERROR_CODES.CONFLICT);
    assertEditable(guestImport.invitation, now);
    const locked = await transaction.invitation.updateMany({ where: { id: guestImport.invitation.id, version: guestImport.invitation.version, ...ownerMembershipWhere(userId) }, data: { version: { increment: 1 } } });
    if (locked.count !== 1) throw new DomainError(ERROR_CODES.STALE_VERSION, { retryable: true });
    const aggregate = await transaction.guestEvent.aggregate({ where: { state: GuestEventState.ACTIVE, guest: { invitationId: guestImport.invitationId, archivedAt: null } }, _sum: { maxPartySize: true } });
    const currentCapacity = aggregate._sum.maxPartySize ?? 0;
    const additional = guestImport.rows.reduce((total, row) => total + sumPartySizes(safeArray(row.assignments).filter((item): item is { maxPartySize: number } => typeof item === "object" && item !== null && typeof (item as { maxPartySize?: unknown }).maxPartySize === "number")), 0);
    if (guestImport.rows.length === 0) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
    if (currentCapacity + additional > INVITED_PEOPLE_LIMIT) throw new DomainError(ERROR_CODES.CAPACITY_EXCEEDED);
    await transaction.guestImport.update({ where: { id: importId }, data: { state: GuestImportState.COMMITTING, includedRows: guestImport.rows.length, capacityBefore: currentCapacity, capacityAdditional: additional, capacityAfter: currentCapacity + additional } });
    await transaction.job.create({ data: { type: GUEST_IMPORT_COMMIT_JOB, dedupKey: `guest-import:commit:${importId}`, payload: { guestImportId: importId } } });
  });
}

export async function setGuestImportRowIncluded(
  database: ImportDatabase,
  userId: string,
  importId: string,
  rowId: string,
  include: boolean,
): Promise<void> {
  await database.$transaction(async (transaction) => {
    const row = await transaction.guestImportRow.findFirst({ where: { id: rowId, guestImportId: importId, guestImport: { invitation: ownerMembershipWhere(userId) } }, select: { id: true, isValid: true, guestImport: { select: { state: true } } } });
    if (!row) throw new DomainError(ERROR_CODES.NOT_FOUND);
    if (row.guestImport.state !== GuestImportState.PREVIEW || (include && !row.isValid)) throw new DomainError(ERROR_CODES.CONFLICT);
    await transaction.guestImportRow.update({ where: { id: row.id }, data: { state: include ? GuestImportRowState.INCLUDED : GuestImportRowState.EXCLUDED } });
    const counts = await transaction.guestImportRow.groupBy({ by: ["state"], where: { guestImportId: importId }, _count: { _all: true } });
    const includedRows = counts.find((item) => item.state === GuestImportRowState.INCLUDED)?._count._all ?? 0;
    await transaction.guestImport.update({ where: { id: importId }, data: { includedRows } });
  });
}

async function commitGuestImportBatch(database: ImportDatabase, userId: string, importId: string, batchSize: number, now: Date): Promise<boolean> {
  return database.$transaction(async (transaction) => {
    const guestImport = await transaction.guestImport.findFirst({ where: { id: importId, invitation: ownerMembershipWhere(userId) }, select: { id: true, invitationId: true, requestedById: true, state: true, invitation: { select: { id: true, version: true, commercialState: true, trialEndsAt: true, activeUntil: true } }, rows: { where: { state: GuestImportRowState.INCLUDED, isValid: true }, orderBy: { rowNumber: "asc" }, take: batchSize, select: { id: true, rowNumber: true, displayName: true, phone: true, groupName: true, assignments: true } } } });
    if (!guestImport) throw new DomainError(ERROR_CODES.NOT_FOUND);
    if (guestImport.state !== GuestImportState.COMMITTING) return true;
    if (guestImport.rows.length === 0) {
      await transaction.guestImport.update({ where: { id: importId }, data: { state: GuestImportState.COMPLETED, completedAt: now } });
      return true;
    }
    assertEditable(guestImport.invitation, now);
    const locked = await transaction.invitation.updateMany({ where: { id: guestImport.invitation.id, version: guestImport.invitation.version, ...ownerMembershipWhere(userId) }, data: { version: { increment: 1 } } });
    if (locked.count !== 1) throw new DomainError(ERROR_CODES.STALE_VERSION, { retryable: true });
    const aggregate = await transaction.guestEvent.aggregate({ where: { state: GuestEventState.ACTIVE, guest: { invitationId: guestImport.invitationId, archivedAt: null } }, _sum: { maxPartySize: true } });
    let available = INVITED_PEOPLE_LIMIT - (aggregate._sum.maxPartySize ?? 0);
    let committed = 0;
    let failed = 0;
    for (const row of guestImport.rows) {
      const assignments = safeArray(row.assignments).filter((item): item is GuestImportAssignment => typeof item === "object" && item !== null && typeof (item as { eventId?: unknown }).eventId === "string" && typeof (item as { maxPartySize?: unknown }).maxPartySize === "number");
      const requestedCapacity = sumPartySizes(assignments);
      if (!row.displayName || assignments.length === 0 || requestedCapacity > available) {
        await transaction.guestImportRow.update({ where: { id: row.id }, data: { state: GuestImportRowState.FAILED, failureCode: requestedCapacity > available ? ERROR_CODES.CAPACITY_EXCEEDED : ERROR_CODES.VALIDATION_FAILED, issues: jsonValue([{ code: requestedCapacity > available ? ERROR_CODES.CAPACITY_EXCEEDED : ERROR_CODES.VALIDATION_FAILED, message: requestedCapacity > available ? "Kapasitas berubah sebelum import selesai." : "Baris tidak lagi valid." }]) } });
        failed += 1;
        continue;
      }
      const groupId = row.groupName ? (await transaction.guestGroup.upsert({ where: { invitationId_name: { invitationId: guestImport.invitationId, name: row.groupName } }, create: { invitationId: guestImport.invitationId, name: row.groupName }, update: {}, select: { id: true } })).id : null;
      const guest = await transaction.guest.create({ data: { invitationId: guestImport.invitationId, displayName: row.displayName, normalizedName: normalizeGuestName(row.displayName), normalizedPhone: row.phone, displayPhone: row.phone, groupId } });
      await transaction.guestEvent.createMany({ data: assignments.map((assignment) => ({ guestId: guest.id, eventId: assignment.eventId, maxPartySize: assignment.maxPartySize })) });
      await transaction.guestImportRow.update({ where: { id: row.id }, data: { state: GuestImportRowState.COMMITTED, guestId: guest.id } });
      await writeAuditEvent(transaction, { actorId: userId, invitationId: guestImport.invitationId, resourceType: "guest_import", resourceId: importId, action: "guest_import.row_committed", metadata: { row_number: row.rowNumber, assignment_count: assignments.length } });
      available -= requestedCapacity;
      committed += 1;
    }
    const remaining = await transaction.guestImportRow.count({ where: { guestImportId: importId, state: GuestImportRowState.INCLUDED, isValid: true } });
    await transaction.guestImport.update({ where: { id: importId }, data: { committedRows: { increment: committed }, failedRows: { increment: failed }, state: remaining === 0 ? GuestImportState.COMPLETED : GuestImportState.COMMITTING, ...(remaining === 0 ? { completedAt: now } : {}) } });
    return remaining === 0;
  });
}

async function claimNextImportJob(database: ImportDatabase): Promise<{ id: string; type: string; importId: string } | null> {
  return database.$transaction(async (transaction) => {
    const job = await transaction.job.findFirst({ where: { state: JobState.PENDING, type: { in: [GUEST_IMPORT_PARSE_JOB, GUEST_IMPORT_COMMIT_JOB] }, runAfter: { lte: new Date() } }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], select: { id: true, type: true, payload: true } });
    if (!job || typeof job.payload !== "object" || job.payload === null || typeof (job.payload as { guestImportId?: unknown }).guestImportId !== "string") return null;
    const claimed = await transaction.job.updateMany({ where: { id: job.id, state: JobState.PENDING }, data: { state: JobState.RUNNING, attempts: { increment: 1 }, startedAt: new Date(), heartbeatAt: new Date() } });
    return claimed.count === 1 ? { id: job.id, type: job.type, importId: (job.payload as { guestImportId: string }).guestImportId } : null;
  });
}

export async function runGuestImportWorker(
  database: ImportDatabase,
  userIdForCommit?: string,
  options: { readonly maxJobs?: number; readonly limits?: GuestImportLimits; readonly now?: () => Date } = {},
): Promise<number> {
  let processed = 0;
  const limits = options.limits ?? getGuestImportLimits();
  while (processed < (options.maxJobs ?? 1)) {
    const job = await claimNextImportJob(database);
    if (!job) break;
    try {
      if (job.type === GUEST_IMPORT_PARSE_JOB) {
        await database.$transaction(async (transaction) => { await transaction.guestImport.updateMany({ where: { id: job.importId, state: GuestImportState.UPLOADED }, data: { state: GuestImportState.PARSING } }); });
        const guestImport = await database.$transaction(async (transaction) => transaction.guestImport.findUnique({ where: { id: job.importId }, select: { requestedById: true } }));
        if (!guestImport) throw new DomainError(ERROR_CODES.NOT_FOUND);
        await parseQueuedImport(database, job.importId, limits);
      } else {
        const guestImport = await database.$transaction(async (transaction) => transaction.guestImport.findUnique({ where: { id: job.importId }, select: { requestedById: true } }));
        if (!guestImport) throw new DomainError(ERROR_CODES.NOT_FOUND);
        const complete = await commitGuestImportBatch(database, userIdForCommit ?? guestImport.requestedById, job.importId, limits.commitBatchSize, options.now?.() ?? new Date());
        if (!complete) {
          await database.$transaction(async (transaction) => { await transaction.job.update({ where: { id: job.id }, data: { state: JobState.PENDING, runAfter: new Date(), leaseOwner: null, leaseExpiresAt: null } }); });
          processed += 1;
          continue;
        }
      }
      await database.$transaction(async (transaction) => { await transaction.job.update({ where: { id: job.id }, data: { state: JobState.SUCCEEDED, completedAt: new Date(), heartbeatAt: new Date() } }); });
      processed += 1;
    } catch (error) {
      const publicCode = error instanceof GuestImportInputError ? error.code : error instanceof DomainError ? error.code : ERROR_CODES.INTERNAL_ERROR;
      await database.$transaction(async (transaction) => {
        await transaction.job.update({ where: { id: job.id }, data: { state: JobState.DEAD_LETTER, lastError: publicCode } });
        await transaction.guestImport.updateMany({ where: { id: job.importId, state: { in: [GuestImportState.UPLOADED, GuestImportState.PARSING, GuestImportState.COMMITTING] } }, data: { state: GuestImportState.FAILED, sourceBytes: null, errorCode: publicCode, statusMessage: publicCode === "ROW_LIMIT_EXCEEDED" ? "Jumlah baris melebihi batas import." : "Import tidak dapat diproses." } });
      });
      processed += 1;
    }
  }
  return processed;
}

export async function confirmGuestImportForOwner(database: ImportDatabase, userId: string, importId: string, options: { readonly now?: () => Date } = {}): Promise<void> {
  await confirmGuestImport(database, userId, importId, { now: options.now });
}

export interface GuestImportView {
  readonly id: string;
  readonly invitationId: string;
  readonly sourceFilename: string;
  readonly state: GuestImportState;
  readonly totalRows: number;
  readonly validRows: number;
  readonly warningRows: number;
  readonly invalidRows: number;
  readonly includedRows: number;
  readonly committedRows: number;
  readonly failedRows: number;
  readonly capacityBefore: number;
  readonly capacityAdditional: number;
  readonly capacityAfter: number;
  readonly errorCode: string | null;
  readonly statusMessage: string | null;
  readonly rows: readonly {
    id: string;
    rowNumber: number;
    displayName: string | null;
    phone: string | null;
    groupName: string | null;
    assignments: readonly GuestImportAssignment[];
    issues: readonly GuestImportIssue[];
    duplicateWarnings: readonly GuestImportDuplicateWarning[];
    isValid: boolean;
    hasWarnings: boolean;
    state: GuestImportRowState;
    guestId: string | null;
  }[];
}

type ImportReadDatabase = Pick<PrismaClient, "guestImport">;

export async function getGuestImportForOwner(database: ImportReadDatabase, userId: string, invitationId: string, importId?: string): Promise<GuestImportView | null> {
  const guestImport = await database.guestImport.findFirst({ where: { invitationId, ...(importId ? { id: importId } : {}), invitation: ownerMembershipWhere(userId) }, orderBy: { createdAt: "desc" }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  if (!guestImport) return null;
  return {
    id: guestImport.id,
    invitationId: guestImport.invitationId,
    sourceFilename: guestImport.sourceFilename,
    state: guestImport.state,
    totalRows: guestImport.totalRows,
    validRows: guestImport.validRows,
    warningRows: guestImport.warningRows,
    invalidRows: guestImport.invalidRows,
    includedRows: guestImport.includedRows,
    committedRows: guestImport.committedRows,
    failedRows: guestImport.failedRows,
    capacityBefore: guestImport.capacityBefore,
    capacityAdditional: guestImport.capacityAdditional,
    capacityAfter: guestImport.capacityAfter,
    errorCode: guestImport.errorCode,
    statusMessage: guestImport.statusMessage,
    rows: guestImport.rows.map((row) => ({ id: row.id, rowNumber: row.rowNumber, displayName: row.displayName, phone: row.phone, groupName: row.groupName, assignments: safeArray(row.assignments) as GuestImportAssignment[], issues: safeArray(row.issues) as GuestImportIssue[], duplicateWarnings: safeArray(row.duplicateWarnings) as GuestImportDuplicateWarning[], isValid: row.isValid, hasWarnings: row.hasWarnings, state: row.state, guestId: row.guestId })),
  };
}
