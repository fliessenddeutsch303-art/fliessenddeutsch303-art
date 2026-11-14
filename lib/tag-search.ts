const aliasGroups = [
  ["electric", "electricity", "power", "كهرباء", "الكهرباء", "كهربا", "شركة الكهرباء"],
  ["water", "مياه", "المياه", "مياة", "شركة المياه"],
  ["company", "شركة", "شركه"],
  ["online", "اونلاين", "أونلاين", "عن بعد"],
  ["offline", "اوفلاين", "أوفلاين", "حضوري"],
  ["morning", "صباحي", "صباح"],
  ["evening", "مسائي", "مساء"],
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ً-ْ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function variants(value: string) {
  const normalized = normalize(value);
  const parts = new Set([normalized]);
  for (const group of aliasGroups) {
    const normalizedGroup = group.map(normalize);
    if (normalizedGroup.some((alias) => normalized.includes(alias))) {
      normalizedGroup.forEach((alias) => parts.add(alias));
    }
  }
  return [...parts].filter(Boolean);
}

export function matchesBilingualTagSearch(tags: string, query: string) {
  const normalizedTags = variants(tags).join(" ");
  const queryVariants = variants(query);
  if (!queryVariants.length) return true;
  return queryVariants.some((part) => normalizedTags.includes(part));
}

/** Other spellings and translations of what was typed (e.g. "كهرباء" -> "electric"), for highlighting matches. */
export function searchAliases(query: string) {
  const normalized = normalize(query);
  return normalized ? variants(query).filter((variant) => variant !== normalized) : [];
}
