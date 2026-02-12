'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatKoreanWon } from '@/lib/utils'
import { updateReservationStatus } from './actions'
import toast, { Toaster } from 'react-hot-toast'

interface Reservation {
  id: string
  customer_name: string
  customer_phone: string
  quantity: number
  pickup_date: string | null
  memo: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  created_at: string
  products: {
    title: string
    price: number
    image_url: string | null
  }
}

const DATE_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'today', label: '오늘' },
] as const

const STATUS_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '대기중' },
  { key: 'confirmed', label: '확인됨' },
  { key: 'cancelled', label: '취소됨' },
  { key: 'completed', label: '완료' },
] as const

const STATUS_STYLES = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-stone-100 text-stone-600 border-stone-200',
}

const STATUS_LABELS = {
  pending: '대기중',
  confirmed: '확인됨',
  cancelled: '취소됨',
  completed: '완료',
}

function formatDate(dateString: string): string {
  const d = new Date(dateString)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatDateTime(dateString: string): string {
  const d = new Date(dateString)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function ReservationList({
  reservations,
  shopSlug,
}: {
  reservations: Reservation[]
  shopSlug: string
}) {
  const router = useRouter()

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{ className: 'text-sm font-medium', duration: 3000 }}
      />

      <div className="space-y-5">
        <h1 className="text-xl font-bold text-stone-900">예약 관리</h1>

        <div className="space-y-3">
          <div className="flex gap-2">
            {DATE_FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === 'all' ? '/admin/reservations' : `/admin/reservations?date=${f.key}`}
                className="rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors bg-white text-stone-500 border border-stone-200 hover:bg-stone-50 hover:text-stone-700"
              >
                {f.label}
              </Link>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === 'all' ? '/admin/reservations' : `/admin/reservations?status=${f.key}`}
                className="rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors bg-white text-stone-500 border border-stone-200 hover:bg-stone-50 hover:text-stone-700"
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {reservations.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white py-16 text-center shadow-sm">
            <Calendar className="mx-auto h-10 w-10 text-stone-300" />
            <p className="mt-3 text-sm text-stone-400">예약이 없습니다</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {reservations.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                reservation={reservation}
                onStatusChange={async (newStatus) => {
                  try {
                    await updateReservationStatus(reservation.id, newStatus)
                    toast.success('예약 상태가 변경되었습니다')
                    router.refresh()
                  } catch (error: any) {
                    toast.error(error.message || '상태 변경에 실패했습니다')
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function ReservationCard({
  reservation,
  onStatusChange,
}: {
  reservation: Reservation
  onStatusChange: (newStatus: 'confirmed' | 'cancelled' | 'completed') => void
}) {
  const [updating, setUpdating] = useState(false)

  async function handleStatusChange(newStatus: 'confirmed' | 'cancelled' | 'completed') {
    setUpdating(true)
    await onStatusChange(newStatus)
    setUpdating(false)
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
          {reservation.products.image_url ? (
            <img
              src={reservation.products.image_url}
              alt={reservation.products.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="h-6 w-6 text-stone-300" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-stone-900 truncate">
              {reservation.products.title}
            </h3>
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium border ${STATUS_STYLES[reservation.status]}`}
            >
              {STATUS_LABELS[reservation.status]}
            </span>
          </div>

          <div className="space-y-1 text-xs text-stone-600">
            <p>
              <span className="font-medium">{reservation.customer_name}</span>
              <span className="mx-2 text-stone-300">·</span>
              <span>{reservation.customer_phone}</span>
            </p>
            <p>
              <span className="font-medium">수량:</span> {reservation.quantity}개
              <span className="mx-2 text-stone-300">·</span>
              <span className="font-medium">금액:</span> {formatKoreanWon(reservation.products.price * reservation.quantity)}
            </p>
            {reservation.pickup_date && (
              <p>
                <span className="font-medium">픽업일:</span> {formatDate(reservation.pickup_date)}
              </p>
            )}
            {reservation.memo && (
              <p className="text-stone-500">
                <span className="font-medium">메모:</span> {reservation.memo}
              </p>
            )}
            <p className="text-stone-400">
              예약일시: {formatDateTime(reservation.created_at)}
            </p>
          </div>

          {reservation.status === 'pending' && (
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-green-200 text-green-700 hover:bg-green-50"
                onClick={() => handleStatusChange('confirmed')}
                disabled={updating}
              >
                확인
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => handleStatusChange('cancelled')}
                disabled={updating}
              >
                취소
              </Button>
            </div>
          )}

          {reservation.status === 'confirmed' && (
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => handleStatusChange('completed')}
                disabled={updating}
              >
                완료 처리
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
