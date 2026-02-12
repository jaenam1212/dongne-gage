import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PHONE_REGEX = /^01[0-9]?[0-9]{3,4}[0-9]{4}$/

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
    product_id?: string
    customer_name?: string
    customer_phone?: string
    quantity?: number
    pickup_date?: string | null
    memo?: string | null
    privacy_agreed?: boolean
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 })
  }

  const { product_id, customer_name, customer_phone, quantity, pickup_date, memo, privacy_agreed } = body

  if (!product_id || !customer_name?.trim() || !customer_phone || !quantity) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 })
  }

  const normalizedPhone = customer_phone.replace(/-/g, '')
  if (!PHONE_REGEX.test(normalizedPhone)) {
    return NextResponse.json(
      { error: '전화번호 형식이 올바르지 않습니다' },
      { status: 400 }
    )
  }

  if (quantity < 1 || quantity > 99) {
    return NextResponse.json({ error: '수량이 올바르지 않습니다' }, { status: 400 })
  }

  if (!privacy_agreed) {
    return NextResponse.json(
      { error: '개인정보 동의가 필요합니다' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('create_reservation', {
    p_product_id: product_id,
    p_customer_name: customer_name.trim(),
    p_customer_phone: normalizedPhone,
    p_quantity: quantity,
    p_pickup_date: pickup_date || null,
    p_memo: memo?.trim() || null,
    p_privacy_agreed: privacy_agreed,
  })

  if (error) {
    if (error.message?.includes('수량') || error.message?.includes('quantity') || error.message?.includes('sold out')) {
      return NextResponse.json(
        { error: '재고가 부족합니다. 수량을 확인해주세요.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: '예약에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      reservation: {
        id: data.id,
        customer_name: data.customer_name,
        quantity: data.quantity,
        pickup_date: data.pickup_date,
        status: data.status,
      },
    },
    { status: 201 }
  )
}
