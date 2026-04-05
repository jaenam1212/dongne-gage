import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPickupDateAllowed, normalizePickupWeekdays } from '@/lib/pickup-weekdays'

const PHONE_REGEX = /^01[0-9]?[0-9]{3,4}[0-9]{4}$/
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

type BatchItem = {
  product_id?: string
  quantity?: number
  selected_options?: Record<string, string>
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60_000 })
    return true
  }

  if (entry.count >= 10) return false
  entry.count++
  return true
}

function normalizeSelectedOptions(selectedOptions: Record<string, string> | null | undefined) {
  return Object.entries(selectedOptions ?? {}).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof key === 'string' && key.trim() && typeof value === 'string' && value.trim()) {
      acc[key] = value
    }
    return acc
  }, {})
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
    shop_slug?: string
    customer_name?: string
    customer_phone?: string
    pickup_date?: string | null
    pickup_time?: string | null
    memo?: string | null
    privacy_agreed?: boolean
    items?: BatchItem[]
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 })
  }

  const {
    shop_slug,
    customer_name,
    customer_phone,
    pickup_date,
    pickup_time,
    memo,
    privacy_agreed,
    items,
  } = body

  if (!shop_slug || !customer_name?.trim() || !customer_phone) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 })
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: '장바구니가 비어 있습니다' }, { status: 400 })
  }

  const normalizedPhone = customer_phone.replace(/-/g, '')
  const normalizedPickupTime = typeof pickup_time === 'string' ? pickup_time.trim() : ''

  if (!PHONE_REGEX.test(normalizedPhone)) {
    return NextResponse.json({ error: '전화번호 형식이 올바르지 않습니다' }, { status: 400 })
  }

  if (normalizedPickupTime && !TIME_REGEX.test(normalizedPickupTime)) {
    return NextResponse.json({ error: '픽업 시간 형식이 올바르지 않습니다' }, { status: 400 })
  }

  if (!privacy_agreed) {
    return NextResponse.json({ error: '개인정보 동의가 필요합니다' }, { status: 400 })
  }

  const normalizedItems = items.map((item) => ({
    product_id: item.product_id,
    quantity: Number(item.quantity),
    selected_options: normalizeSelectedOptions(item.selected_options),
  }))

  if (
    normalizedItems.some(
      (item) => !item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99
    )
  ) {
    return NextResponse.json({ error: '장바구니 상품 정보가 올바르지 않습니다' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    const { data: shopWithWeekdays } = await supabase
      .from('shops')
      .select('id, slug, name, read_only_mode, is_system_owner, pickup_available_weekdays')
      .eq('slug', shop_slug)
      .eq('is_active', true)
      .maybeSingle()

    const { data: shopFallback } = shopWithWeekdays
      ? { data: null }
      : await supabase
          .from('shops')
          .select('id, slug, name, read_only_mode, is_system_owner')
          .eq('slug', shop_slug)
          .eq('is_active', true)
          .maybeSingle()

    const shop = shopWithWeekdays ?? shopFallback

    if (!shop) {
      return NextResponse.json({ error: '가게를 찾을 수 없습니다' }, { status: 404 })
    }

    if (shop.read_only_mode && !shop.is_system_owner) {
      return NextResponse.json(
        { error: '현재 해당 가게는 결제 갱신이 필요해 예약을 받고 있지 않습니다.' },
        { status: 403 }
      )
    }

    const productIds = normalizedItems.map((item) => item.product_id)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, shop_id, title, option_groups, pickup_time_required, is_active')
      .in('id', productIds)

    if (productsError || !products || products.length !== productIds.length) {
      return NextResponse.json({ error: '장바구니 상품을 다시 확인해주세요.' }, { status: 400 })
    }

    const productMap = new Map(products.map((product) => [product.id, product]))
    const requiresPickupTime = products.some((product) => product.pickup_time_required)

    if (requiresPickupTime && !pickup_date) {
      return NextResponse.json({ error: '픽업 날짜를 선택해주세요' }, { status: 400 })
    }
    if (requiresPickupTime && !normalizedPickupTime) {
      return NextResponse.json({ error: '픽업 시간을 입력해주세요' }, { status: 400 })
    }

    const allowedWeekdays = normalizePickupWeekdays(shop.pickup_available_weekdays ?? null)
    if (pickup_date && !isPickupDateAllowed(pickup_date, allowedWeekdays)) {
      return NextResponse.json(
        { error: '선택한 날짜는 픽업이 불가능합니다. 다른 요일을 선택해주세요.' },
        { status: 400 }
      )
    }

    for (const item of normalizedItems) {
      const product = productMap.get(item.product_id)
      if (!product || product.shop_id !== shop.id || !product.is_active) {
        return NextResponse.json({ error: '장바구니 상품을 다시 확인해주세요.' }, { status: 400 })
      }

      const optionGroups = Array.isArray(product.option_groups)
        ? (product.option_groups as Array<{ name?: string; values?: string[]; required?: boolean }>)
        : []

      for (const group of optionGroups) {
        const optionName = (group.name ?? '').trim()
        const values = Array.isArray(group.values) ? group.values : []
        const required = group.required !== false
        const selectedValue = item.selected_options[optionName]

        if (!optionName || values.length === 0) continue
        if (required && !selectedValue) {
          return NextResponse.json({ error: `${product.title}의 ${optionName} 옵션을 선택해주세요` }, { status: 400 })
        }
        if (selectedValue && !values.includes(selectedValue)) {
          return NextResponse.json({ error: `${product.title}의 옵션 값이 올바르지 않습니다` }, { status: 400 })
        }
      }
    }

    const { data, error } = await supabase.rpc('create_reservations_batch', {
      p_shop_id: shop.id,
      p_customer_name: customer_name.trim(),
      p_customer_phone: normalizedPhone,
      p_pickup_date: pickup_date || null,
      p_pickup_time: normalizedPickupTime || null,
      p_memo: memo?.trim() || null,
      p_privacy_agreed: privacy_agreed,
      p_items: normalizedItems,
    })

    if (error) {
      if (
        error.message?.includes('PER_CUSTOMER_LIMIT') ||
        error.message?.includes('STOCK_EXCEEDED') ||
        error.message?.includes('INVENTORY_')
      ) {
        return NextResponse.json(
          { error: '재고 또는 구매 제한으로 예약에 실패했습니다. 장바구니 수량을 확인해주세요.' },
          { status: 409 }
        )
      }
      if (error.message?.includes('PICKUP_DATE_REQUIRED')) {
        return NextResponse.json({ error: '픽업 날짜를 선택해주세요' }, { status: 400 })
      }
      if (error.message?.includes('PICKUP_TIME_REQUIRED')) {
        return NextResponse.json({ error: '픽업 시간을 입력해주세요' }, { status: 400 })
      }
      if (error.message?.includes('PICKUP_DATE_NOT_ALLOWED')) {
        return NextResponse.json({ error: '선택한 날짜는 픽업이 불가능합니다.' }, { status: 400 })
      }
      return NextResponse.json(
        { error: '장바구니 예약에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        reservations: Array.isArray(data) ? data : [],
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unhandled reservation batch API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
