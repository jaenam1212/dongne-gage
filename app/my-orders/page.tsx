'use client'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'
import { formatKoreanWon } from '@/lib/utils'
import { getMyOrders, type StoredOrder } from '@/lib/my-orders-storage'
import { formatDateKST } from '@/lib/datetime-kst'

const STATUS_LABELS: Record<StoredOrder['status'], string> = {
  pending: '대기중',
  confirmed: '확인됨',
  cancelled: '취소됨',
  completed: '완료',
}

const STATUS_STYLES: Record<StoredOrder['status'], string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-stone-100 text-stone-600 border-stone-200',
}

function formatDate(dateString: string): string {
  return formatDateKST(dateString)
}

function MyOrdersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const [orders, setOrders] = useState<StoredOrder[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setOrders(getMyOrders())
      setMounted(true)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  function handleBack() {
    if (returnTo) {
      router.push(`/${returnTo}`)
    } else {
      window.history.back()
    }
  }

  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-stone-200 bg-white/80 backdrop-blur-lg px-4">
        <button
          type="button"
          onClick={handleBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-700 transition-colors min-h-[44px] min-w-[44px]"
          aria-label="뒤로 가기"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold text-stone-900">내 주문 내역</h1>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {!mounted ? (
          <div className="rounded-2xl border border-stone-200 bg-white py-12 text-center">
            <p className="text-sm text-stone-400">불러오는 중...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white py-16 text-center shadow-sm">
            <Package className="mx-auto h-12 w-12 text-stone-300" />
            <p className="mt-3 text-sm text-stone-500">저장된 주문 내역이 없습니다</p>
            <p className="mt-1 text-xs text-stone-400">
              예약 완료 시 이 기기에 자동으로 저장됩니다
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
            >
              가게 찾아보기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/${order.shop_slug}`}
                className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-stone-400">{order.shop_name}</p>
                    <h3 className="mt-0.5 text-sm font-semibold text-stone-900 truncate">
                      {order.product_title}
                    </h3>
                    <p className="mt-1 text-base font-bold text-stone-800">
                      {formatKoreanWon(order.total_price)}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {order.quantity}개 · 예약일 {formatDate(order.created_at)}
                      {order.pickup_date && ` · 픽업 ${formatDate(order.pickup_date)}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium border ${STATUS_STYLES[order.status]}`}
                  >
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function MyOrdersFallback() {
  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-stone-200 bg-white/80 backdrop-blur-lg px-4">
        <div className="h-9 w-9 min-h-[44px] min-w-[44px]" />
        <h1 className="text-lg font-bold text-stone-900">내 주문 내역</h1>
      </header>
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="rounded-2xl border border-stone-200 bg-white py-12 text-center">
          <p className="text-sm text-stone-400">불러오는 중...</p>
        </div>
      </main>
    </div>
  )
}

export default function MyOrdersPage() {
  return (
    <Suspense fallback={<MyOrdersFallback />}>
      <MyOrdersContent />
    </Suspense>
  )
}
