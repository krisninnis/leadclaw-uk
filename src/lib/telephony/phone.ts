// Phone number utilities for the telephony layer.
//
// Pure, dependency-free helpers so they are trivially unit-testable and safe to
// import anywhere (no env access, no network, no crash at import time).

const DEFAULT_CALLING_CODE = "44"; // United Kingdom

/**
 * Normalise a raw phone number into E.164 form (e.g. "+447700900123").
 *
 * Handles the common UK input shapes:
 *   "07700 900123"      -> "+447700900123"
 *   "+44 7700 900123"   -> "+447700900123"
 *   "0044 7700 900123"  -> "+447700900123"
 *   "447700900123"      -> "+447700900123"
 *   "(0117) 496 0000"   -> "+441174960000"
 *
 * Returns null when the value is empty, anonymous, or clearly not a phone
 * number. The result is a best-effort normalisation, not a guarantee that the
 * number is reachable.
 */
export function normalisePhoneNumber(
  value: string | null | undefined,
  defaultCallingCode: string = DEFAULT_CALLING_CODE,
): string | null {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  // Twilio represents withheld / anonymous caller IDs in a few ways.
  const lowered = raw.toLowerCase();
  if (
    lowered === "anonymous" ||
    lowered === "unavailable" ||
    lowered === "unknown" ||
    lowered === "restricted" ||
    lowered === "private"
  ) {
    return null;
  }

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;

  let e164Digits: string;

  if (hasPlus) {
    // Already international, just strip formatting.
    e164Digits = digits;
  } else if (digits.startsWith("00")) {
    // International access code form (00 + country code).
    e164Digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    // National (trunk) form -> swap leading 0 for the calling code.
    e164Digits = defaultCallingCode + digits.slice(1);
  } else if (digits.startsWith(defaultCallingCode)) {
    // Country code already present without a plus.
    e164Digits = digits;
  } else {
    // Bare national-significant number without a trunk 0.
    e164Digits = defaultCallingCode + digits;
  }

  // E.164 allows up to 15 digits; require a sensible minimum to reject junk.
  if (e164Digits.length < 8 || e164Digits.length > 15) {
    return null;
  }

  return `+${e164Digits}`;
}

/** True when the value is already a well-formed E.164 string. */
export function isValidE164(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\+[1-9]\d{7,14}$/.test(value);
}
