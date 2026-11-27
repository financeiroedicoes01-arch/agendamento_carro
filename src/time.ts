import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
export let timezone = "America/Sao_Paulo";
export function setTimezone(value: string) {
  timezone = value;
}
export function fmt(value: string | Date, pattern = "dd/MM/yyyy · HH:mm") {
  return formatInTimeZone(value, timezone, pattern, { locale: ptBR });
}
export function inputTime(value: string | Date = new Date()) {
  return fmt(value, "yyyy-MM-dd'T'HH:mm");
}
export function iso(value: string) {
  return fromZonedTime(value, timezone).toISOString();
}
export function dayIso(date: string, time = "00:00") {
  return iso(`${date}T${time}`);
}
export function overlap(a: string, b: string, c: string, d: string) {
  return new Date(a) < new Date(d) && new Date(c) < new Date(b);
}
export function plusDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function today() {
  return fmt(new Date(), "yyyy-MM-dd");
}
export function nearPrevious(
  events: { vehicle_id: string; ends_at: string; kind?: string }[],
  start: string,
  vehicleId: string,
) {
  const t = new Date(start).getTime();
  return events.some(
    (e) =>
      e.vehicle_id === vehicleId &&
      e.kind !== "maintenance" &&
      e.kind !== "history" &&
      t >= new Date(e.ends_at).getTime() &&
      t - new Date(e.ends_at).getTime() <= 1800000,
  );
}
