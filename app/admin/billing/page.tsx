'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestPayment: (method: string, params: Record<string, unknown>) => void
    }
  }
}

type CheckoutPayload = {
  clientKey: string
  method: string
  paymentParams: Record<string, unknown>
}

export default function BillingPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const queryStatus = useMemo(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('status')
  }, [])

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://js.tosspayments.com/v1/payment'
    script.async = true
    document.body.appendChild(script)
    return () => {
      document.body.removeChild(script)
    }
  }, [])

  useEffect(() => {
    if (queryStatus === 'success') setStatusMessage('결제가 완료되었습니다.')
    if (queryStatus === 'failed') setStatusMessage('결제가 실패했습니다. 다시 시도해주세요.')
  }, [queryStatus])

  async function handlePay() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/toss/checkout', { method: 'POST' })
      const data = (await res.json()) as CheckoutPayload & { error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? '결제 준비에 실패했습니다.')
        setLoading(false)
        return
      }

      if (!window.TossPayments) {
        setError('결제 모듈 로드에 실패했습니다. 잠시 후 다시 시도해주세요.')
        setLoading(false)
        return
      }

      const tossPayments = window.TossPayments(data.clientKey)
      tossPayments.requestPayment(data.method, data.paymentParams)
    } catch {
      setError('결제 요청 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-900">결제 관리</h1>
        <p className="mt-1 text-sm text-stone-500">
          무료체험 종료 후에는 결제가 필요합니다. 결제 완료 시 즉시 편집 기능이 복구됩니다.
        </p>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {statusMessage}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
        <p className="text-sm text-stone-700">월 정기결제 시작 (토스)</p>
        <Button
          type="button"
          onClick={handlePay}
          disabled={loading}
          className="bg-stone-900 text-white hover:bg-stone-800"
        >
          {loading ? '결제 준비 중...' : '월 정기결제 시작하기'}
        </Button>
      </div>
    </div>
  )
}
