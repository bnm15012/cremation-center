import { format } from "date-fns";

const IST_OFFSET_MINUTES = 330; // UTC+5:30

export function toIST(date: Date | string | number): Date {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return d;
  return new Date(d.getTime() + (d.getTimezoneOffset() + IST_OFFSET_MINUTES) * 60_000);
}

export function formatIST(
  date: Date | string | number | null | undefined,
  pattern = "dd MMM yyyy"
): string {
  if (!date) return "—";
  try {
    return format(toIST(new Date(date)), pattern);
  } catch {
    return "—";
  }
}
