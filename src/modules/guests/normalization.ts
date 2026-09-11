import { DomainError } from "@/modules/errors";
import { ERROR_CODES } from "@/modules/errors/codes";

const PHONE_CHARACTERS = /^[+()\d\s.-]+$/;

/** Normalize Indonesian/local phone input into a stable E.164-like value. */
export function normalizePhone(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const trimmed = value.trim();
  if (!PHONE_CHARACTERS.test(trimmed)) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);

  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 8 || digits.length > 15) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);

  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8") && digits.length <= 12) digits = `62${digits}`;

  if (digits.length < 8 || digits.length > 15) throw new DomainError(ERROR_CODES.VALIDATION_FAILED);
  return `+${digits}`;
}

/** Normalize owner-entered names for conservative duplicate detection. */
export function normalizeGuestName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
