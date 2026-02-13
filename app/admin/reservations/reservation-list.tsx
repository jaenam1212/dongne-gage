'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Package, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatKoreanWon } from '@/lib/utils'
import { formatDateKST, formatDateTimeKST, formatMonthDayKST, getTodayKST } from '@/lib/datetime-kst'
import { updateReservationStatus, updateReservationsStatusBulk } from './actions'
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

function buildReservationsCsv(reservations: Reservation[]): string {
  const BOM = '\uFEFF'
  const headers = ['예약일시', '상품명', '예약자', '연락처', '수량', '단가', '금액', '픽업희망일', '메모', '상태']
  const escape = (v: string | number | null | undefined): string => {
    if (v == null) return ''
    const s = String(v).replace(/"/g, '""')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
  }
  const rows = reservations.map((r) => {
    const product = r.products as { title?: string; price?: number } | null
    const title = product?.title ?? ''
    const price = product?.price ?? 0
    const amount = price * r.quantity
    const dateStr = r.created_at ? formatDateTime(r.created_at) : ''
    const pickupStr = r.pickup_date ? formatDateKST(r.pickup_date) : ''
    return [
      dateStr,
      title,
      r.customer_name,
      r.customer_phone,
      r.quantity,
      price,
      amount,
      pickupStr,
      r.memo ?? '',
      STATUS_LABELS[r.status],
    ].map((val) => escape(val)).join(',')
  })
  return BOM + [headers.join(','), ...rows].join('\n')
}

function formatDate(dateString: string): string {
  return formatMonthDayKST(dateString)
}

function formatDateTime(dateString: string): string {
  return formatDateTimeKST(dateString)
}

export function ReservationList({
  reservations,
  shopSlug,
}: {
  reservations: Reservation[]
  shopSlug: string
}) {
  const router = useRouter()
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === reservations.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(reservations.map((r) => r.id)))
  }

  function exitSelectionMode() {
    setIsSelectionMode(false)
    setSelectedIds(new Set())
  }

  function handleExcelDownload() {
    if (reservations.length === 0) {
      toast.error('다운로드할 예약이 없습니다')
      return
    }
    const csv = buildReservationsCsv(reservations)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `예약목록_${getTodayKST()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('엑셀 파일이 다운로드되었습니다')
  }

  async function handleBulkStatus(newStatus: 'confirmed' | 'cancelled' | 'completed') {
    if (selectedIds.size === 0) {
      toast.error('예약을 선택해주세요')
      return
    }
    const action = newStatus === 'confirmed' ? '확인' : newStatus === 'cancelled' ? '취소' : '완료'
    if (!confirm(`선택한 ${selectedIds.size}건 예약을 일괄 ${action} 처리할까요?`)) return
    setBulkUpdating(true)
    try {
      const result = await updateReservationsStatusBulk(Array.from(selectedIds), newStatus)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`${selectedIds.size}건 ${action} 처리되었습니다`)
        exitSelectionMode()
        router.refresh()
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '일괄 처리에 실패했습니다'
      toast.error(message)
    } finally {
      setBulkUpdating(false)
    }
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{ className: 'text-sm font-medium', duration: 3000 }}
      />

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-stone-900">예약 관리</h1>
          {reservations.length > 0 && (
            <>
              {!isSelectionMode ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={handleExcelDownload}
                  >
                    <FileDown className="h-4 w-4 mr-1.5" />
                    엑셀 다운로드
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => setIsSelectionMode(true)}
                  >
                    일괄 처리
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={exitSelectionMode}
                  >
                    취소
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 border-green-200 text-green-700 hover:bg-green-50"
                    disabled={selectedIds.size === 0 || bulkUpdating}
                    onClick={() => handleBulkStatus('confirmed')}
                  >
                    일괄 확인 {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 border-red-200 text-red-700 hover:bg-red-50"
                    disabled={selectedIds.size === 0 || bulkUpdating}
                    onClick={() => handleBulkStatus('cancelled')}
                  >
                    일괄 취소 {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    disabled={selectedIds.size === 0 || bulkUpdating}
                    onClick={() => handleBulkStatus('completed')}
                  >
                    일괄 완료 {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

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
            {isSelectionMode && reservations.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <Checkbox
                  id="select-all-reservations"
                  checked={selectedIds.size === reservations.length}
                  onCheckedChange={toggleSelectAll}
                />
                <label htmlFor="select-all-reservations" className="text-sm text-stone-600 cursor-pointer">
                  전체 선택
                </label>
              </div>
            )}
            {reservations.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                reservation={reservation}
                isSelectionMode={isSelectionMode}
                selected={selectedIds.has(reservation.id)}
                onSelectChange={() => toggleSelect(reservation.id)}
                onStatusChange={async (newStatus) => {
                  try {
                    await updateReservationStatus(reservation.id, newStatus)
                    toast.success('예약 상태가 변경되었습니다')
                    router.refresh()
                  } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : '상태 변경에 실패했습니다'
                    toast.error(message)
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
  isSelectionMode,
  selected,
  onSelectChange,
  onStatusChange,
}: {
  reservation: Reservation
  isSelectionMode: boolean
  selected: boolean
  onSelectChange: () => void
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
        {isSelectionMode && (
          <div className="flex shrink-0 items-start pt-0.5">
            <Checkbox
              id={`select-${reservation.id}`}
              checked={selected}
              onCheckedChange={onSelectChange}
              aria-label={`${reservation.products.title} 예약 선택`}
            />
          </div>
        )}
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
