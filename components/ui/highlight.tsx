import { Fragment } from "react";

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

/** Renders `text` with the parts matching `query` marked. */
export function Highlight({ text, query, digitsOnly = false }: { text: string; query: string; digitsOnly?: boolean }) {
  const ranges = matchRanges(text, query, digitsOnly);
  if (!ranges.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], index) => {
    if (start > cursor) parts.push(<Fragment key={`t${index}`}>{text.slice(cursor, start)}</Fragment>);
    parts.push(<mark key={`m${index}`} className="rounded-sm bg-yellow-200 px-0.5 text-inherit">{text.slice(start, end)}</mark>);
    cursor = end;
  });
  if (cursor < text.length) parts.push(<Fragment key="rest">{text.slice(cursor)}</Fragment>);
  return <>{parts}</>;
}
