/**
 * Portal URLs contain a readable name followed by a token. The token is
 * generated without hyphens, so the final URL segment is always unambiguous.
 */
export function extractPortalToken(value: string) {
  return value.split("-").at(-1) ?? value;
}
