import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

function getTossAuthHeader(secretKey: string) {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`
}

export async function GET(request: NextRequest) {
  const paymentKey = request.nextUrl.searchParams.get('paymentKey')
  const orderId = request.nextUrl.searchParams.get('orderId')
  const amount = request.nextUrl.searchParams.get('amount')
  const secretKey = process.env.TOSS_SECRET_KEY
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  if (!paymentKey || !orderId || !amount || !secretKey) {
    return NextResponse.redirect(`${baseUrl}/admin/billing?status=failed`)
  }

  const admin = createServiceRoleClient()

  try {
    const confirmRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: getTossAuthHeader(secretKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount: Number(amount),
      }),
    })

    const confirmData = await confirmRes.json()
    if (!confirmRes.ok) {
      await admin.from('shop_billing_events').insert({
        provider: 'toss',
        event_type: 'payment_confirm_failed',
        event_status: 'failed',
        order_id: orderId,
        payment_key: paymentKey,
        amount: Number(amount),
        currency: 'KRW',
        raw_payload: confirmData,
      })
      return NextResponse.redirect(`${baseUrl}/admin/billing?status=failed`)
    }

    const { data: lastEvent } = await admin
      .from('shop_billing_events')
      .select('shop_id')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastEvent?.shop_id) {
      const now = new Date()
      const { data: shop } = await admin
        .from('shops')
        .select('id, trial_ends_at')
        .eq('id', lastEvent.shop_id)
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
            shop_id: lastEvent.shop_id,
            provider: 'toss',
            plan_code: 'starter_monthly',
            status: 'active',
            billing_key: paymentKey,
            customer_key: confirmData.customerKey ?? null,
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            last_payment_at: now.toISOString(),
            next_billing_at: periodEnd.toISOString(),
            metadata: confirmData,
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
        .eq('id', lastEvent.shop_id)

      await admin.from('shop_billing_events').insert({
        shop_id: lastEvent.shop_id,
        provider: 'toss',
        event_type: 'payment_confirmed',
        event_status: 'success',
        order_id: orderId,
        payment_key: paymentKey,
        amount: Number(amount),
        currency: 'KRW',
        raw_payload: confirmData,
      })
    }

    return NextResponse.redirect(`${baseUrl}/admin/billing?status=success`)
  } catch (error) {
    console.error('Toss success callback error:', error)
    return NextResponse.redirect(`${baseUrl}/admin/billing?status=failed`)
  }
}
