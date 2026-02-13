/** 한국 시간(Asia/Seoul, KST UTC+9) 기준 날짜/시간 유틸 */

const TZ = 'Asia/Seoul'

/** 오늘 날짜를 KST 기준 YYYY-MM-DD */
export function getTodayKST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

/** 현재 시각을 KST 기준 datetime-local 값(YYYY-MM-DDTHH:mm) */
export function getNowKSTDateTimeLocal(): string {
  const s = new Date().toLocaleString('sv-SE', { timeZone: TZ })
  const [datePart, timePart] = s.split(' ')
  if (!datePart || !timePart) return getTodayKST() + 'T00:00'
  const [h, m] = timePart.split(':')
  return `${datePart}T${h}:${m}`
}

/** KST 날짜(YYYY-MM-DD)의 00:00:00을 UTC ISO로 */
export function getKSTDayStartUTC(kstDate: string): string {
  const d = new Date(kstDate + 'T00:00:00+09:00')
  return d.toISOString()
}

/** KST 날짜(YYYY-MM-DD)의 다음날 00:00:00을 UTC ISO로 (해당일 포함 범위 끝) */
export function getKSTDayEndExclusiveUTC(kstDate: string): string {
  const start = new Date(kstDate + 'T00:00:00+09:00')
  const next = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const nextStr = next.toLocaleDateString('en-CA', { timeZone: TZ })
  return getKSTDayStartUTC(nextStr)
}

/** ISO UTC 문자열을 KST 기준 datetime-local 값(YYYY-MM-DDTHH:mm)으로 */
export function toKSTDateTimeLocal(isoUtc: string | null): string {
  if (!isoUtc) return ''
  try {
    const d = new Date(isoUtc)
    const s = d.toLocaleString('sv-SE', { timeZone: TZ })
    const [datePart, timePart] = s.split(' ')
    if (!datePart || !timePart) return ''
    const [h, m] = timePart.split(':')
    return `${datePart}T${h}:${m}`
  } catch {
    return ''
  }
}

/** KST로 해석되는 datetime-local 값(YYYY-MM-DDTHH:mm)을 ISO UTC로 */
export function fromKSTToISOUTC(kstDateTimeLocal: string): string {
  if (!kstDateTimeLocal || !kstDateTimeLocal.includes('T')) return kstDateTimeLocal
  const d = new Date(kstDateTimeLocal + '+09:00')
  return d.toISOString()
}

/** ISO UTC → KST 날짜만 YYYY-MM-DD (폼 date input용) */
export function toKSTDateOnly(isoUtc: string | null): string {
  if (!isoUtc) return ''
  try {
    return new Date(isoUtc).toLocaleDateString('en-CA', { timeZone: TZ })
  } catch {
    return ''
  }
}

/** ISO UTC → KST 시간만 HH:mm (폼 time input용). 23:59면 '' 반환(날짜만 선택한 경우) */
export function toKSTTimeOnly(isoUtc: string | null): string {
  if (!isoUtc) return ''
  try {
    const d = new Date(isoUtc)
    const h = d.toLocaleString('en-CA', { timeZone: TZ, hour: '2-digit', hour12: false })
    const m = d.toLocaleString('en-CA', { timeZone: TZ, minute: '2-digit' })
    const t = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
    return t === '23:59' ? '' : t
  } catch {
    return ''
  }
}

/** 날짜(YYYY-MM-DD) + 시간(HH:mm, 빈 값 가능) → KST로 해석해 ISO UTC */
export function fromKSTDateAndTimeToISOUTC(dateStr: string, timeStr: string): string {
  if (!dateStr) return ''
  const time = (timeStr || '').trim() || '23:59'
  return fromKSTToISOUTC(`${dateStr}T${time}`)
}

/** ISO UTC를 KST datetime-local로 해석해 Date로 (비교용) */
export function parseUTC(isoUtc: string | null): Date | null {
  if (!isoUtc) return null
  const d = new Date(isoUtc)
  return isNaN(d.getTime()) ? null : d
}

/** KST 기준 날짜만 표시 (예: 2025. 2. 15) */
export function formatDateKST(isoString: string | null): string {
  if (!isoString) return ''
  try {
    return new Date(isoString).toLocaleDateString('ko-KR', { timeZone: TZ })
  } catch {
    return ''
  }
}

/** KST 기준 월/일 시:분 (예: 2/15 14:00) */
export function formatDateTimeKST(isoString: string | null): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    const month = d.toLocaleString('ko-KR', { timeZone: TZ, month: 'numeric' })
    const day = d.toLocaleString('ko-KR', { timeZone: TZ, day: 'numeric' })
    const hour = d.toLocaleString('ko-KR', { timeZone: TZ, hour: '2-digit', hour12: false })
    const minute = d.toLocaleString('ko-KR', { timeZone: TZ, minute: '2-digit' })
    return `${month}/${day} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  } catch {
    return ''
  }
}

/** KST 기준 월/일만 (예: 2/15) */
export function formatMonthDayKST(isoString: string | null): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    const month = d.toLocaleString('ko-KR', { timeZone: TZ, month: 'numeric' })
    const day = d.toLocaleString('ko-KR', { timeZone: TZ, day: 'numeric' })
    return `${month}/${day}`
  } catch {
    return ''
  }
}
