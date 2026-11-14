// The academy runs on Cairo time, the server on UTC.
export const ACADEMY_TIME_ZONE = "Africa/Cairo";

function parts(date: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: ACADEMY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return { year: values.year, month: values.month, day: values.day };
}

export function academyDate(date = new Date()) {
  const { year, month, day } = parts(date);
  return `${year}-${month}-${day}`;
}

export function academyMonthStart(date = new Date()) {
  const { year, month } = parts(date);
  return `${year}-${month}-01`;
}

export function academyDaysAgo(days: number) {
  return academyDate(new Date(Date.now() - days * 86400000));
}

// 00:00 Cairo as an ISO string, for timestamptz filters
export function academyDayStartIso(day: string) {
  const noonUtc = new Date(`${day}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: ACADEMY_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(noonUtc)
    .find((part) => part.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  return new Date(`${day}T00:00:00${offset === "" ? "+00:00" : offset}`).toISOString();
}

export function academyDateOf(value: string | null | undefined) {
  return value ? academyDate(new Date(value)) : "";
}

export function academyWeekday(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone: ACADEMY_TIME_ZONE, weekday: "long" }).format(date).toLowerCase();
}
