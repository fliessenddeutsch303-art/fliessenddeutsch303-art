const toLatinDigits = (value: string) => value.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));

/** Digits typed in a search box, Arabic-Indic digits included; spaces, dashes and "+" are ignored. */
export const searchDigits = (query: string) => toLatinDigits(query).replace(/\D/g, "");

/** Index ranges [start, end) in `text` that match `query`: plain text case-insensitively, or by digits only for phone numbers. */
export function matchRanges(text: string, query: string, digitsOnly = false): Array<[number, number]> {
  if (!text || !query.trim()) return [];
  if (digitsOnly) {
    const wanted = searchDigits(query);
    if (!wanted) return [];
    // Positions of each digit in the original text, so "010 1234" highlights correctly when the query is "0101".
    const positions: number[] = [];
    const digits = [...toLatinDigits(text)].map((char, index) => /\d/.test(char) ? (positions.push(index), char) : "").join("");
    const ranges: Array<[number, number]> = [];
    for (let at = digits.indexOf(wanted); at !== -1; at = digits.indexOf(wanted, at + wanted.length)) ranges.push([positions[at], positions[at + wanted.length - 1] + 1]);
    return ranges;
  }
  const haystack = text.toLowerCase();
  const needle = query.trim().toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) ranges.push([at, at + needle.length]);
  return ranges;
}
