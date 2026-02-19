/**
 * Convert datetime-local value (YYYY-MM-DDTHH:mm) to Unix timestamp (seconds).
 * Interprets the value in the user's local timezone.
 */
export function datetimeLocalToUnix(value: string): number {
  if (!value) return 0
  const date = new Date(value)
  return Math.floor(date.getTime() / 1000)
}

/**
 * Convert Unix timestamp (seconds) to datetime-local value (YYYY-MM-DDTHH:mm).
 */
export function unixToDatetimeLocal(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
