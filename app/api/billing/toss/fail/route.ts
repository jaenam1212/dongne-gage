import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const message = request.nextUrl.searchParams.get('message')
  const orderId = request.nextUrl.searchParams.get('orderId')
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const admin = createServiceRoleClient()

  try {
    const { data: lastEvent } = await admin
      .from('shop_billing_events')
      .select('shop_id')
      .eq('order_id', orderId ?? '')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    await admin.from('shop_billing_events').insert({
      shop_id: lastEvent?.shop_id ?? null,
      provider: 'toss',
      event_type: 'payment_failed',
      event_status: 'failed',
      order_id: orderId,
      raw_payload: {
        code,
        message,
      },
    })
  } catch (error) {
    console.error('Toss fail callback log error:', error)
  }

  return NextResponse.redirect(`${baseUrl}/admin/billing?status=failed`)
}
