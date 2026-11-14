// token has no hyphens so the last URL segment is unambiguous
export function extractPortalToken(value: string) {
  return value.split("-").at(-1) ?? value;
}
