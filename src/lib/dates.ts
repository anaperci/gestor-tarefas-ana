export const APP_TIMEZONE = "America/Sao_Paulo";
export function todayDate(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
}
export function civilDate(value: string): Date { return new Date(`${value}T12:00:00`); }
export function isOverdueDate(value: string, status: string, now = new Date()): boolean {
  return !!value && status !== "done" && value < todayDate(now);
}
export function dayOfWeek(date = todayDate()): number { return civilDate(date).getDay(); }
export function daysAgo(days: number): string {
  const date = civilDate(todayDate()); date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
