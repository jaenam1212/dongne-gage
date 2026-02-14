import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

type UsageEventPayload = {
  eventType?: string
  path?: string
  visitorId?: string
  shopSlug?: string
  metadata?: Record<string, unknown>
}

function resolveSlugFromPath(path: string): string | null {
  const sanitized = path.split('?')[0].trim()
  if (!sanitized.startsWith('/')) return null
  const [first] = sanitized.slice(1).split('/')
  if (!first) return null
  if (['admin', 'api', 'signup', 'my-orders'].includes(first)) return null
  return first
}

export async function POST(request: NextRequest) {
  let body: UsageEventPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const eventType = (body.eventType ?? '').trim()
  if (!eventType) {
    return NextResponse.json({ error: 'eventType is required' }, { status: 400 })
  }

  const path = (body.path ?? '').trim() || null
  const visitorId = (body.visitorId ?? '').trim() || null
  const metadata = body.metadata ?? null
  const slug = (body.shopSlug ?? '').trim() || (path ? resolveSlugFromPath(path) : null)

  try {
    const admin = createServiceRoleClient()
    let shopId: string | null = null
    if (slug) {
      const { data: shop } = await admin
        .from('shops')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      shopId = shop?.id ?? null
    }

    await admin.from('usage_events').insert({
      shop_id: shopId,
      event_type: eventType,
      path,
      visitor_id: visitorId,
      metadata,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Usage event logging failed:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
