/** Phone helpers shared by client and server code (lib/excel.ts is a client module and cannot run on the server). */
export function normalizePhone(value: unknown) {
  let text = String(value ?? "").trim().replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
  if (!text || /[^\d\s.\-()+]/.test(text)) return text;
  const international = text.startsWith("+");
  let digits = text.replace(/\D/g, "");
  if (!digits) return text;
  const prefixed = digits.startsWith("00");
  if (prefixed) digits = digits.slice(2);
  if (/^1[0125]\d{8}$/.test(digits) && !international && !prefixed) return `0${digits}`;
  if (/^01[0125]\d{8}$/.test(digits)) return digits;
  if (/^201[0125]\d{8}$/.test(digits)) return `0${digits.slice(2)}`;
  return international || prefixed ? `+${digits}` : digits;
}

/** Stored spellings an existing record for the same number might use. */
export function phoneVariants(value: unknown) {
  const raw = String(value ?? "").trim();
  const normal = normalizePhone(raw);
  const variants = new Set([raw, normal]);
  if (/^01[0125]\d{8}$/.test(normal)) { variants.add(normal.slice(1)); variants.add(`20${normal.slice(1)}`); variants.add(`+20${normal.slice(1)}`); }
  return [...variants].filter(Boolean);
}
