import { format } from "date-fns";

export function formatRoundDateTime(value: string) {
  return format(new Date(value), "EEE, MMM d, yyyy 'at' h:mm a");
}

export function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - offset * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

export function toDateInputValue(value: string) {
  return toDateTimeLocal(value).slice(0, 10);
}

export function toTimeInputValue(value: string) {
  return toDateTimeLocal(value).slice(11, 16);
}
