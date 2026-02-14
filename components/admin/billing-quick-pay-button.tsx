'use client'

import { useEffect, useState } from 'react'
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
  error?: string
}

interface BillingQuickPayButtonProps {
  label?: string
  disabled?: boolean
}

export function BillingQuickPayButton({ label = '미리 결제 등록하기', disabled = false }: BillingQuickPayButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://js.tosspayments.com/v1/payment'
    script.async = true
    document.body.appendChild(script)
    return () => {
      document.body.removeChild(script)
    }
  }, [])

  async function handlePay() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/toss/checkout', { method: 'POST' })
      const data = (await res.json()) as CheckoutPayload

      if (!res.ok || data.error) {
        setError(data.error ?? '결제 준비에 실패했습니다.')
        setLoading(false)
        return
      }

      if (!window.TossPayments) {
        setError('결제 모듈 로드에 실패했습니다.')
        setLoading(false)
        return
      }

      const toss = window.TossPayments(data.clientKey)
      toss.requestPayment(data.method, data.paymentParams)
    } catch {
      setError('결제 요청 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handlePay}
        disabled={loading || disabled}
        className="bg-stone-900 text-white hover:bg-stone-800"
      >
        {loading ? '결제 준비 중...' : label}
      </Button>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
