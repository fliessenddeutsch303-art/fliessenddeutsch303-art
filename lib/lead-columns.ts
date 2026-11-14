export const NAME_ALIASES = ["Name", "Full name", "Student name", "الاسم", "الإسم", "اسم", "الاسم الكامل", "اسم الطالب"];
export const PHONE_ALIASES = ["Phone", "Number", "Mobile", "الهاتف", "رقم الهاتف", "الموبايل", "رقم الموبايل", "الجوال", "التليفون", "رقم التليفون", "واتساب"];

const squash = (value: string) => value.toLowerCase().replace(/[\s_-]/g, "");

/** First column whose name matches one of the aliases. */
export function findColumn(columns: string[], aliases: string[]) {
  return columns.find((column) => aliases.some((alias) => squash(column) === squash(alias)));
}
