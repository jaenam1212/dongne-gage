'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import toast, { Toaster } from 'react-hot-toast'
import { Loader2, Package, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TimePickerField } from '@/components/ui/time-picker'
import {
  clearCart,
  getCartItems,
  removeCartItem,
  replaceCartItems,
  subscribeCartUpdates,
  updateCartItemQuantity,
  type CartItem,
} from '@/lib/cart-storage'
import { getTodayKST } from '@/lib/datetime-kst'
import { saveOrderToMyOrders } from '@/lib/my-orders-storage'
import { formatPickupWeekdays, isPickupDateAllowed, normalizePickupWeekdays } from '@/lib/pickup-weekdays'
import { formatKoreanWon } from '@/lib/utils'

interface Product {
  id: string
  title: string
  price: number
  image_url: string | null
  max_quantity: number | null
  max_quantity_per_customer?: number | null
  reserved_count: number
  option_groups?: { name: string; values: string[]; required?: boolean }[] | null
  pickup_time_required?: boolean
}

interface ReservationResponse {
  id: string
  product_id: string
  customer_name: string
  quantity: number
  pickup_date: string | null
  pickup_time: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
}

const PHONE_REGEX = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

function normalizePhone(phone: string): string {
  return phone.replace(/-/g, '')
}

function getRemainingQuantity(product: Product): number | null {
  if (product.max_quantity == null) return null
  return Number(product.max_quantity) - Number(product.reserved_count ?? 0)
}

function getMaxQuantity(product: Product): number {
  const remaining = getRemainingQuantity(product)
  const perCustomer = product.max_quantity_per_customer ?? 99
  return remaining !== null
    ? Math.max(0, Math.min(remaining, perCustomer, 99))
    : Math.max(0, Math.min(perCustomer, 99))
}

function formatSelectedOptions(selectedOptions: Record<string, string>): string {
  const entries = Object.entries(selectedOptions)
  if (entries.length === 0) return '옵션 없음'
  return entries.map(([key, value]) => `${key}: ${value}`).join(' / ')
}

export function CartPageClient({
  shopSlug,
  shopName,
  products,
  pickupAvailableWeekdays,
}: {
  shopSlug: string
  shopName: string
  products: Product[]
  pickupAvailableWeekdays?: number[] | null
}) {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [completedReservations, setCompletedReservations] = useState<ReservationResponse[] | null>(null)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const allowedWeekdays = normalizePickupWeekdays(pickupAvailableWeekdays)

  useEffect(() => {
    const sync = () => {
      const stored = getCartItems(shopSlug)
      const available = stored.filter((item) => productMap.has(item.product_id))
      if (available.length !== stored.length) {
        replaceCartItems(shopSlug, available)
      }
      setCartItems(available)
    }

    sync()
    return subscribeCartUpdates(shopSlug, sync)
  }, [productMap, shopSlug])

  const cartLines = useMemo(
    () =>
      cartItems
        .map((item) => {
          const product = productMap.get(item.product_id)
          if (!product) return null
          return { item, product, maxQty: getMaxQuantity(product) }
        })
        .filter((line): line is { item: CartItem; product: Product; maxQty: number } => !!line),
    [cartItems, productMap]
  )

  const totalPrice = cartLines.reduce(
    (sum, line) => sum + line.product.price * line.item.quantity,
    0
  )
  const requiresPickupTime = cartLines.some((line) => line.product.pickup_time_required)

  function handleQuantityChange(itemId: string, value: string, maxQty: number) {
    const parsed = Number.parseInt(value, 10)
    const nextQty = Number.isNaN(parsed) ? 1 : Math.max(1, Math.min(parsed, Math.max(1, maxQty || 1)))
    updateCartItemQuantity(shopSlug, itemId, nextQty)
    setCartItems(getCartItems(shopSlug))
  }

  function handleRemoveItem(itemId: string) {
    removeCartItem(shopSlug, itemId)
    setCartItems(getCartItems(shopSlug))
  }

  async function handleSubmit(formData: FormData) {
    if (cartLines.length === 0) {
      toast.error('장바구니가 비어 있습니다')
      return
    }

    const newErrors: Record<string, string> = {}
    const customerName = (formData.get('customer_name') as string)?.trim()
    const customerPhone = (formData.get('customer_phone') as string)?.trim()
    const pickupDate = (formData.get('pickup_date') as string)?.trim()
    const pickupTime = (formData.get('pickup_time') as string)?.trim()
    const memo = (formData.get('memo') as string)?.trim()

    if (!customerName) newErrors.customer_name = '이름을 입력해주세요'
    if (!customerPhone || !PHONE_REGEX.test(customerPhone)) {
      newErrors.customer_phone = '전화번호 형식이 올바르지 않습니다 (예: 010-1234-5678)'
    }
    if (!privacyAgreed) newErrors.privacy = '개인정보 동의가 필요합니다'
    if (pickupTime && !TIME_REGEX.test(pickupTime)) {
      newErrors.pickup_time = '시간 형식이 올바르지 않습니다'
    }
    if (requiresPickupTime && !pickupDate) {
      newErrors.pickup_date = '픽업 날짜를 선택해주세요'
    }
    if (requiresPickupTime && !pickupTime) {
      newErrors.pickup_time = '픽업 시간을 입력해주세요'
    }
    if (pickupDate && !isPickupDateAllowed(pickupDate, allowedWeekdays)) {
      newErrors.pickup_date = '선택한 날짜는 픽업이 불가능합니다'
    }

    for (const line of cartLines) {
      if (line.maxQty < 1) {
        newErrors[`item_${line.item.id}`] = '재고가 부족해 예약할 수 없습니다'
        continue
      }
      if (line.item.quantity > line.maxQty) {
        newErrors[`item_${line.item.id}`] = `최대 ${line.maxQty}개까지 담을 수 있습니다`
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setLoading(true)

    try {
      const response = await fetch('/api/reservations/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_slug: shopSlug,
          customer_name: customerName,
          customer_phone: normalizePhone(customerPhone),
          pickup_date: pickupDate || null,
          pickup_time: pickupTime || null,
          memo: memo || null,
          privacy_agreed: privacyAgreed,
          items: cartLines.map((line) => ({
            product_id: line.product.id,
            quantity: line.item.quantity,
            selected_options: line.item.selected_options,
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error || '장바구니 예약에 실패했습니다')
        return
      }

      const reservations = (data.reservations ?? []) as ReservationResponse[]
      for (const reservation of reservations) {
        const line = cartLines.find((item) => item.product.id === reservation.product_id)
        if (!line) continue
        saveOrderToMyOrders({
          id: reservation.id,
          shop_slug: shopSlug,
          shop_name: shopName,
          product_title: line.product.title,
          product_price: line.product.price,
          quantity: reservation.quantity,
          total_price: line.product.price * reservation.quantity,
          pickup_date: reservation.pickup_date ?? null,
          pickup_time: reservation.pickup_time ?? null,
          status: reservation.status,
          customer_name: reservation.customer_name,
          created_at: new Date().toISOString(),
        })
      }

      clearCart(shopSlug)
      setCartItems([])
      setCompletedReservations(reservations)
    } catch {
      toast.error('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  if (completedReservations) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 text-center shadow-sm">
          <h2 className="text-xl font-bold text-stone-900">장바구니 예약이 완료되었습니다</h2>
          <p className="mt-2 text-sm text-stone-500">
            총 {completedReservations.length}개 상품이 예약되었습니다.
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="space-y-3">
            {completedReservations.map((reservation) => {
              const product = productMap.get(reservation.product_id)
              if (!product) return null
              return (
                <div key={reservation.id} className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3 last:border-b-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900">{product.title}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {reservation.quantity}개 · {formatKoreanWon(product.price * reservation.quantity)}
                    </p>
                  </div>
                  <code className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700">
                    {reservation.id.slice(0, 8).toUpperCase()}
                  </code>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(`/my-orders?returnTo=${encodeURIComponent(shopSlug)}`)}
            className="flex-1 h-12 rounded-xl border-stone-200"
          >
            내 주문 내역
          </Button>
          <Button
            onClick={() => router.push(`/${shopSlug}`)}
            className="flex-1 h-12 rounded-xl bg-stone-900 text-white hover:bg-stone-800"
          >
            가게로 돌아가기
          </Button>
        </div>
      </div>
    )
  }

  if (cartLines.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white py-16 text-center shadow-sm">
        <Package className="mx-auto h-12 w-12 text-stone-300" />
        <p className="mt-3 text-sm text-stone-500">장바구니가 비어 있습니다</p>
        <p className="mt-1 text-xs text-stone-400">상품 상세에서 장바구니에 먼저 담아주세요.</p>
        <Button
          onClick={() => router.push(`/${shopSlug}`)}
          className="mt-5 rounded-xl bg-stone-900 text-white hover:bg-stone-800"
        >
          상품 보러가기
        </Button>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium', duration: 3000 }} />
      <div className="space-y-5">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-stone-900">장바구니 상품</h2>
              <p className="mt-1 text-sm text-stone-500">같은 가게 상품을 한 번에 예약할 수 있습니다.</p>
            </div>
            <Button variant="outline" className="border-stone-200" onClick={() => clearCart(shopSlug)}>
              전체 비우기
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {cartLines.map((line) => (
              <div key={line.item.id} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="flex gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                    {line.product.image_url ? (
                      <Image
                        src={line.product.image_url}
                        alt={line.product.title}
                        width={80}
                        height={80}
                        sizes="80px"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-6 w-6 text-stone-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{line.product.title}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {formatSelectedOptions(line.item.selected_options)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(line.item.id)}
                        className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700"
                        aria-label="장바구니 항목 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-stone-900">{formatKoreanWon(line.product.price)}</p>
                        <p className="text-xs text-stone-400">
                          {line.maxQty > 0 ? `최대 ${line.maxQty}개` : '예약 불가'}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={Math.max(1, line.maxQty)}
                        value={line.item.quantity}
                        onChange={(event) =>
                          handleQuantityChange(line.item.id, event.target.value, line.maxQty)
                        }
                        className="h-10 w-24 border-stone-200 bg-white text-right"
                        aria-invalid={!!errors[`item_${line.item.id}`]}
                      />
                    </div>
                    {errors[`item_${line.item.id}`] && (
                      <p className="mt-2 text-xs text-red-500">{errors[`item_${line.item.id}`]}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4">
            <p className="text-sm text-stone-500">총 결제 예정 금액</p>
            <p className="text-xl font-extrabold text-stone-900">{formatKoreanWon(totalPrice)}</p>
          </div>
        </div>

        <form action={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name" className="text-stone-700">
                이름 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="customer_name"
                name="customer_name"
                placeholder="예약자 이름"
                className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400 h-11"
                aria-invalid={!!errors.customer_name}
              />
              {errors.customer_name && <p className="text-xs text-red-500">{errors.customer_name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_phone" className="text-stone-700">
                전화번호 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="customer_phone"
                name="customer_phone"
                type="tel"
                placeholder="010-1234-5678"
                className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400 h-11"
                aria-invalid={!!errors.customer_phone}
              />
              {errors.customer_phone && <p className="text-xs text-red-500">{errors.customer_phone}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup_date" className="text-stone-700">
                픽업 희망일
                {requiresPickupTime ? <span className="text-red-500"> *</span> : null}
              </Label>
              <DatePicker
                name="pickup_date"
                min={getTodayKST()}
                allowedWeekdays={allowedWeekdays}
                placeholder="날짜 선택"
                className="w-full"
                inputClassName="h-11"
              />
              <p className="text-xs text-stone-400">픽업 가능 요일: {formatPickupWeekdays(allowedWeekdays)}</p>
              {errors.pickup_date && <p className="text-xs text-red-500">{errors.pickup_date}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickup_time" className="text-stone-700">
                픽업 희망 시간
                {requiresPickupTime ? (
                  <span className="text-red-500"> *</span>
                ) : (
                  <span className="text-stone-400 font-normal"> (선택)</span>
                )}
              </Label>
              <TimePickerField
                name="pickup_time"
                placeholder="시간 선택"
                className="w-full"
                inputClassName="h-11"
              />
              {errors.pickup_time && <p className="text-xs text-red-500">{errors.pickup_time}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="memo" className="text-stone-700">메모</Label>
              <Textarea
                id="memo"
                name="memo"
                placeholder="요청 사항이 있으면 적어주세요"
                rows={2}
                className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400 resize-none"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="cart-privacy"
                checked={privacyAgreed}
                onCheckedChange={(checked) => setPrivacyAgreed(checked === true)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="cart-privacy" className="cursor-pointer text-sm text-stone-700">
                  개인정보 수집 및 이용에 동의합니다 <span className="text-red-500">(필수)</span>
                </Label>
                <p className="mt-1 text-xs text-stone-400">수집 항목: 이름, 전화번호 / 목적: 예약 관리</p>
              </div>
            </div>
            {errors.privacy && <p className="text-xs text-red-500">{errors.privacy}</p>}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-stone-900 text-base font-semibold text-white hover:bg-stone-800"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                장바구니 예약 처리 중...
              </>
            ) : (
              `총 ${cartLines.length}개 상품 예약하기`
            )}
          </Button>
        </form>
      </div>
    </>
  )
}
