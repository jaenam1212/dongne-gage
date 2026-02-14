import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60_000 })
    return true
  }

  if (entry.count >= 10) {
    return false
  }

  entry.count++
  return true
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      { status: 429 }
    )
  }

  let body: {
    endpoint?: string
    keys?: {
      p256dh?: string
      auth?: string
    }
    shopId?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 })
  }

  const { endpoint, keys, shopId } = body

  if (!endpoint || !keys?.p256dh || !keys?.auth || !shopId) {
    return NextResponse.json(
      { error: '필수 정보가 누락되었습니다' },
      { status: 400 }
    )
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase.from('push_subscriptions').insert({
      shop_id: shopId,
      endpoint: endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      customer_phone: null,
    })

    if (error) {
      console.error('Push subscription error:', error)
      return NextResponse.json(
        { error: '구독에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Unhandled push subscribe API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
