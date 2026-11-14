const toLatinDigits = (value: string) => value.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));

export const searchDigits = (query: string) => toLatinDigits(query).replace(/\D/g, "");

// [start, end) ranges, digitsOnly compares digits only
export function matchRanges(text: string, query: string, digitsOnly = false): Array<[number, number]> {
  if (!text || !query.trim()) return [];
  if (digitsOnly) {
    const wanted = searchDigits(query);
    if (!wanted) return [];
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
