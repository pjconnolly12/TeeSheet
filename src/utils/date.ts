import { format } from "date-fns";

export function formatRoundDateTime(value: string) {
  return format(new Date(value), "EEE, MMM d, yyyy 'at' h:mm a");
}

export function localDateTimeToUtcIso(dateValue: string, timeValue: string) {
  const [yearPart, monthPart, dayPart] = dateValue.split("-");
  const [hourPart, minutePart] = timeValue.split(":");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return localDate.toISOString();
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
