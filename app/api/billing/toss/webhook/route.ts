import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

function verifySignature(rawBody: string, signature: string, secret: string) {
  const hmac = createHmac('sha256', secret).update(rawBody).digest('hex')
  const expected = Buffer.from(hmac)
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const webhookSecret = process.env.TOSS_WEBHOOK_SECRET
  const signature = request.headers.get('toss-signature')

  if (webhookSecret && signature) {
    const ok = verifySignature(rawBody, signature, webhookSecret)
    if (!ok) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const eventType = String(payload.eventType ?? payload.type ?? 'unknown')
  const data = (payload.data as Record<string, unknown> | undefined) ?? payload
  const orderId = String(data.orderId ?? '')
  const paymentKey = String(data.paymentKey ?? '')
  const amount = Number(data.totalAmount ?? data.amount ?? 0)
  const status = String(data.status ?? payload.status ?? '')

  const admin = createServiceRoleClient()

  const { data: lastEvent } = await admin
    .from('shop_billing_events')
    .select('shop_id')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const shopId = lastEvent?.shop_id ?? null
  const now = new Date()

  if (shopId) {
    if (['DONE', 'SUCCESS', 'PAID'].includes(status.toUpperCase())) {
      const { data: shop } = await admin
        .from('shops')
        .select('id, trial_ends_at')
        .eq('id', shopId)
        .single()
      const trialEnd = shop?.trial_ends_at ? new Date(shop.trial_ends_at) : now
      const isTrialActive = now <= trialEnd
      const periodStart = isTrialActive ? trialEnd : now
      const periodEnd = new Date(periodStart)
      periodEnd.setMonth(periodEnd.getMonth() + 1)

      await admin
        .from('shop_subscriptions')
        .upsert(
          {
            shop_id: shopId,
            provider: 'toss',
            plan_code: 'starter_monthly',
            status: 'active',
            billing_key: paymentKey || null,
            customer_key: data.customerKey ? String(data.customerKey) : null,
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            last_payment_at: now.toISOString(),
            next_billing_at: periodEnd.toISOString(),
            metadata: payload,
            updated_at: now.toISOString(),
          },
          { onConflict: 'shop_id' }
        )

      await admin
        .from('shops')
        .update({
          billing_status: isTrialActive ? 'trialing' : 'active',
          read_only_mode: false,
          plan_code: 'starter_monthly',
          next_billing_at: periodEnd.toISOString(),
          billing_updated_at: now.toISOString(),
        })
        .eq('id', shopId)
    } else if (['FAILED', 'CANCELED', 'ABORTED', 'EXPIRED'].includes(status.toUpperCase())) {
      await admin
        .from('shops')
        .update({
          billing_status: 'past_due',
          read_only_mode: true,
          billing_updated_at: now.toISOString(),
        })
        .eq('id', shopId)
    }
  }

  await admin.from('shop_billing_events').insert({
    shop_id: shopId,
    provider: 'toss',
    event_type: `webhook:${eventType}`,
    event_status: status || null,
    order_id: orderId || null,
    payment_key: paymentKey || null,
    amount: Number.isFinite(amount) ? amount : null,
    currency: 'KRW',
    raw_payload: payload,
  })

  return NextResponse.json({ ok: true })
}
