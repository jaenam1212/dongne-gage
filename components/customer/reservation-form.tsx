'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, CheckCircle2, Copy } from 'lucide-react'
import { formatKoreanWon } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'

interface Product {
  id: string
  title: string
  price: number
  image_url: string | null
  max_quantity: number | null
  reserved_count: number
  deadline: string | null
}

interface ReservationResult {
  id: string
  customer_name: string
  quantity: number
  pickup_date: string | null
}

const PHONE_REGEX = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/

function normalizePhone(phone: string): string {
  return phone.replace(/-/g, '')
}

function getRemainingQuantity(product: Product): number | null {
  if (product.max_quantity === null) return null
  return product.max_quantity - product.reserved_count
}

export function ReservationForm({
  product,
  shopSlug,
}: {
  product: Product
  shopSlug: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [result, setResult] = useState<ReservationResult | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const remaining = getRemainingQuantity(product)
  const maxQty = remaining !== null ? Math.min(remaining, 99) : 99

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const newErrors: Record<string, string> = {}

    const name = (form.get('customer_name') as string)?.trim()
    const phone = (form.get('customer_phone') as string)?.trim()
    const quantity = parseInt(form.get('quantity') as string) || 0
    const pickupDate = form.get('pickup_date') as string
    const memo = form.get('memo') as string

    if (!name) newErrors.customer_name = '이름을 입력해주세요'
    if (!phone || !PHONE_REGEX.test(phone)) {
      newErrors.customer_phone = '전화번호 형식이 올바르지 않습니다 (예: 010-1234-5678)'
    }
    if (quantity < 1) newErrors.quantity = '수량을 선택해주세요'
    if (remaining !== null && quantity > remaining) {
      newErrors.quantity = `최대 ${remaining}개까지 예약할 수 있습니다`
    }
    if (!privacyAgreed) newErrors.privacy = '개인정보 동의가 필요합니다'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setLoading(true)

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          customer_name: name,
          customer_phone: normalizePhone(phone),
          quantity,
          pickup_date: pickupDate || null,
          memo: memo?.trim() || null,
          privacy_agreed: privacyAgreed,
        }),
      })

      if (res.status === 429) {
        toast.error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.')
        return
      }

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || '예약에 실패했습니다')
        return
      }

      setResult(data.reservation)
    } catch {
      toast.error('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-md space-y-6 px-4 py-10 text-center">
        <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium', duration: 3000 }} />

        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-stone-900">예약이 완료되었습니다</h2>
          <p className="mt-1 text-sm text-stone-500">아래 예약번호를 저장해주세요</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <p className="text-xs text-stone-400">예약번호</p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <code className="text-lg font-bold text-stone-900 tracking-wider">
                {result.id.slice(0, 8).toUpperCase()}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(result.id.slice(0, 8).toUpperCase())
                  toast.success('복사되었습니다')
                }}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="h-px bg-stone-100" />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-stone-400">상품</p>
              <p className="mt-0.5 font-medium text-stone-700">{product.title}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400">수량</p>
              <p className="mt-0.5 font-medium text-stone-700">{result.quantity}개</p>
            </div>
            <div>
              <p className="text-xs text-stone-400">예약자</p>
              <p className="mt-0.5 font-medium text-stone-700">{result.customer_name}</p>
            </div>
            {result.pickup_date && (
              <div>
                <p className="text-xs text-stone-400">픽업일</p>
                <p className="mt-0.5 font-medium text-stone-700">{result.pickup_date}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-stone-400">금액</p>
              <p className="mt-0.5 font-bold text-stone-900">
                {formatKoreanWon(product.price * result.quantity)}
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => router.push(`/${shopSlug}`)}
          className="w-full h-12 bg-stone-900 text-white hover:bg-stone-800 rounded-xl text-base font-semibold"
        >
          가게로 돌아가기
        </Button>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium', duration: 3000 }} />

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100">
              {product.image_url ? (
                <img src={product.image_url} alt={product.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="h-6 w-6 rounded bg-stone-200" />
                </div>
              )}
            </div>
            <div>
              <h3 className="font-bold text-stone-900">{product.title}</h3>
              <p className="text-lg font-extrabold text-stone-900 tracking-tight">
                {formatKoreanWon(product.price)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer_name" className="text-stone-700">
              이름 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="customer_name"
              name="customer_name"
              placeholder="예약자 이름"
              required
              className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400 h-11"
              aria-invalid={!!errors.customer_name}
            />
            {errors.customer_name && (
              <p className="text-xs text-red-500">{errors.customer_name}</p>
            )}
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
              required
              inputMode="tel"
              className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400 h-11"
              aria-invalid={!!errors.customer_phone}
            />
            {errors.customer_phone && (
              <p className="text-xs text-red-500">{errors.customer_phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-stone-700">
              수량 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              max={maxQty}
              defaultValue={1}
              required
              inputMode="numeric"
              className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400 h-11"
              aria-invalid={!!errors.quantity}
            />
            {remaining !== null && (
              <p className="text-xs text-stone-400">{remaining}개 남음</p>
            )}
            {errors.quantity && (
              <p className="text-xs text-red-500">{errors.quantity}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pickup_date" className="text-stone-700">
              픽업 희망일
            </Label>
            <Input
              id="pickup_date"
              name="pickup_date"
              type="date"
              min={new Date().toISOString().split('T')[0]}
              className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400 h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="memo" className="text-stone-700">
              메모
            </Label>
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
              id="privacy"
              checked={privacyAgreed}
              onCheckedChange={(checked) => setPrivacyAgreed(checked === true)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="privacy" className="text-sm text-stone-700 cursor-pointer">
                개인정보 수집 및 이용에 동의합니다{' '}
                <span className="text-red-500">(필수)</span>
              </Label>
              <button
                type="button"
                onClick={() => setShowPrivacy(!showPrivacy)}
                className="mt-1 block text-xs text-stone-400 underline underline-offset-2 hover:text-stone-600 transition-colors"
              >
                {showPrivacy ? '닫기' : '자세히 보기'}
              </button>
            </div>
          </div>

          {showPrivacy && (
            <div className="rounded-xl bg-stone-50 p-4 text-xs text-stone-500 leading-relaxed space-y-1">
              <p>• 수집 항목: 이름, 전화번호</p>
              <p>• 목적: 예약 관리</p>
              <p>• 보유 기간: 예약 완료 후 1년</p>
            </div>
          )}

          {errors.privacy && (
            <p className="text-xs text-red-500">{errors.privacy}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-stone-900 text-white hover:bg-stone-800 rounded-xl text-base font-semibold min-h-[44px]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              예약 처리 중...
            </>
          ) : (
            '예약하기'
          )}
        </Button>
      </form>
    </>
  )
}
