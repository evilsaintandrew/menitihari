import { describe, expect, it } from "vitest";

import {
  GuestImportInputError,
  getGuestImportLimits,
  parseGuestImportFile,
  validateGuestImportRows,
} from "@/modules/guests";

const csv = (value: string) => new TextEncoder().encode(value);

describe("guest import parser", () => {
  it("parses quoted CSV rows and the supported Indonesian column names", () => {
    const rows = parseGuestImportFile(csv("nama tamu,telepon,grup,acara,max orang\n\"Bpk. Andi, Jr.\",0812 3456 7890,Keluarga,Akad; Resepsi,4\nSinta,,,Akad,"), "tamu.csv", "text/csv");

    expect(rows).toEqual([
      expect.objectContaining({ rowNumber: 2, displayName: "Bpk. Andi, Jr.", phone: "0812 3456 7890", groupName: "Keluarga", eventNames: ["Akad", "Resepsi"], maxPartySize: 4 }),
      expect.objectContaining({ rowNumber: 3, displayName: "Sinta", eventNames: ["Akad"], maxPartySize: 1 }),
    ]);
  });

  it("enforces configurable file and row limits before work is queued", () => {
    expect(getGuestImportLimits({ GUEST_IMPORT_MAX_FILE_BYTES: "42", GUEST_IMPORT_MAX_ROWS: "7", GUEST_IMPORT_COMMIT_BATCH_SIZE: "999" })).toEqual({ maxFileBytes: 42, maxRows: 7, commitBatchSize: 500 });
    expect(() => parseGuestImportFile(csv("nama\nAndi\nBima"), "tamu.csv", "text/csv", { maxFileBytes: 2, maxRows: 10, commitBatchSize: 10 })).toThrowError(GuestImportInputError);
    expect(() => parseGuestImportFile(csv("nama\nAndi\nBima"), "tamu.csv", "text/csv", { maxFileBytes: 100, maxRows: 1, commitBatchSize: 10 })).toThrow(/Jumlah baris maksimal/);
    expect(() => parseGuestImportFile(csv("nama\nAndi"), "tamu.pdf", "application/pdf")).toThrow(/CSV atau Excel/);
  });

  it("returns row-level validation errors and duplicate warnings without dropping valid rows", () => {
    const parsed = parseGuestImportFile(csv("nama,telepon,acara,max orang\nAndi,081234567890,Akad,2\nSinta,not-a-phone,Tidak Ada,0"), "tamu.csv", "text/csv");
    const result = validateGuestImportRows(parsed, [{ id: "event-1", name: "Akad" }], [{ id: "guest-1", displayName: "Andi", normalizedName: "andi", normalizedPhone: "+6281234567890" }]);

    expect(result[0]).toMatchObject({ isValid: true, hasWarnings: true, assignments: [{ eventId: "event-1", maxPartySize: 2 }], duplicateWarnings: [{ guestId: "guest-1", matchingSignals: ["PHONE", "NAME"] }] });
    expect(result[1]).toMatchObject({ isValid: false, hasWarnings: false, assignments: [] });
    expect(result[1].issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["INVALID_PHONE", "EVENT_NOT_FOUND", "INVALID_PARTY_SIZE"]));
  });
});
