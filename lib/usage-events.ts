export type UsageEventInput = {
  eventType: string
  path?: string
  shopSlug?: string
  metadata?: Record<string, unknown>
}

const VISITOR_KEY = 'dongnegage:visitor-id'

function getVisitorId() {
  if (typeof window === 'undefined') return ''
  const existing = window.localStorage.getItem(VISITOR_KEY)
  if (existing) return existing
  const created = crypto.randomUUID()
  window.localStorage.setItem(VISITOR_KEY, created)
  return created
}

export async function trackUsageEvent(input: UsageEventInput) {
  try {
    await fetch('/api/usage-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: input.eventType,
        path: input.path ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
        shopSlug: input.shopSlug,
        visitorId: getVisitorId(),
        metadata: input.metadata ?? null,
      }),
      keepalive: true,
    })
  } catch {
    // ignore telemetry failure
  }
}
