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
    selected_options?: Record<string, string>
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 })
  }

  const {
    product_id,
    customer_name,
    customer_phone,
    quantity,
    pickup_date,
    memo,
    privacy_agreed,
    selected_options,
  } = body

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

  try {
    const supabase = await createClient()

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('shop_id, option_groups')
      .eq('id', product_id)
      .single()

    if (productError || !product?.shop_id) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다' }, { status: 404 })
    }

    const optionGroups =
      Array.isArray(product.option_groups) ? (product.option_groups as Array<{
        name?: string
        values?: string[]
        required?: boolean
      }>) : []
    const normalizedSelectedOptions = selected_options ?? {}

    for (const group of optionGroups) {
      const optionName = (group.name ?? '').trim()
      const values = Array.isArray(group.values) ? group.values : []
      const required = group.required !== false
      const selectedValue = normalizedSelectedOptions[optionName]

      if (!optionName || values.length === 0) {
        continue
      }
      if (required && !selectedValue) {
        return NextResponse.json(
          { error: `${optionName} 옵션을 선택해주세요` },
          { status: 400 }
        )
      }
      if (selectedValue && !values.includes(selectedValue)) {
        return NextResponse.json(
          { error: `${optionName} 옵션 값이 올바르지 않습니다` },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase.rpc('create_reservation', {
      p_product_id: product_id,
      p_shop_id: product.shop_id,
      p_customer_name: customer_name.trim(),
      p_customer_phone: normalizedPhone,
      p_quantity: quantity,
      p_pickup_date: pickup_date || null,
      p_memo: memo?.trim() || null,
      p_privacy_agreed: privacy_agreed,
      p_selected_options: normalizedSelectedOptions,
    })

    if (error) {
      if (error.message?.includes('PER_CUSTOMER_LIMIT') || error.message?.includes('Per customer limit') || error.message?.includes('per person')) {
        const match = error.message.match(/Max (\d+)/i)
        const max = match ? match[1] : ''
        return NextResponse.json(
          { error: max ? `1인당 최대 ${max}개까지 예약할 수 있습니다.` : '1인당 구매 수량 제한을 초과했습니다.' },
          { status: 409 }
        )
      }
      if (
        error.message?.includes('STOCK_EXCEEDED') ||
        error.message?.includes('INVENTORY_SHORTAGE') ||
        error.message?.includes('INVENTORY_INACTIVE') ||
        error.message?.includes('수량') ||
        error.message?.includes('quantity') ||
        error.message?.includes('sold out')
      ) {
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
  } catch (error) {
    console.error('Unhandled reservation API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
