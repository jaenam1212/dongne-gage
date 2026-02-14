import { NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const admin = createServiceRoleClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { data: shop } = await supabase
      .from('shops')
      .select('id, name')
      .eq('owner_id', user.id)
      .single()

    if (!shop) {
      return NextResponse.json({ error: '가게 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const clientKey = process.env.TOSS_CLIENT_KEY
    if (!clientKey) {
      return NextResponse.json({ error: '결제 설정이 아직 완료되지 않았습니다.' }, { status: 500 })
    }

    const amount = Number.parseInt(process.env.BILLING_MONTHLY_AMOUNT ?? '9900', 10)
    const orderId = `ORDER-${shop.id.slice(0, 8)}-${Date.now()}`
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    await admin.from('shop_billing_events').insert({
      shop_id: shop.id,
      provider: 'toss',
      event_type: 'checkout_ready',
      event_status: 'pending',
      order_id: orderId,
      amount,
      currency: 'KRW',
      raw_payload: {
        source: 'checkout',
      },
    })

    return NextResponse.json({
      clientKey,
      method: '카드',
      paymentParams: {
        amount,
        orderId,
        orderName: `${shop.name} 월 구독 결제`,
        customerName: shop.name,
        successUrl: `${baseUrl}/api/billing/toss/success`,
        failUrl: `${baseUrl}/api/billing/toss/fail`,
      },
    })
  } catch (error) {
    console.error('Toss checkout prepare error:', error)
    return NextResponse.json({ error: '결제 준비에 실패했습니다.' }, { status: 500 })
  }
}
