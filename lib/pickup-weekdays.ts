export const PICKUP_WEEKDAY_OPTIONS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
] as const

export const DEFAULT_PICKUP_WEEKDAYS = PICKUP_WEEKDAY_OPTIONS.map((item) => item.value)

export function normalizePickupWeekdays(input: unknown): number[] {
  if (!Array.isArray(input)) {
    return [...DEFAULT_PICKUP_WEEKDAYS]
  }

  const values = input
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)

  if (values.length === 0) {
    return [...DEFAULT_PICKUP_WEEKDAYS]
  }

  return PICKUP_WEEKDAY_OPTIONS
    .map((item) => item.value)
    .filter((value) => values.includes(value))
}

export function isPickupDateAllowed(
  dateString: string | null | undefined,
  allowedWeekdays: number[] | null | undefined
): boolean {
  if (!dateString) return true

  const normalized = normalizePickupWeekdays(allowedWeekdays ?? DEFAULT_PICKUP_WEEKDAYS)
  const date = new Date(`${dateString}T12:00:00`)
  if (Number.isNaN(date.getTime())) return false

  return normalized.includes(date.getDay())
}

export function formatPickupWeekdays(weekdays: number[] | null | undefined): string {
  const normalized = normalizePickupWeekdays(weekdays ?? DEFAULT_PICKUP_WEEKDAYS)
  return PICKUP_WEEKDAY_OPTIONS
    .filter((item) => normalized.includes(item.value))
    .map((item) => item.label)
    .join(', ')
}
