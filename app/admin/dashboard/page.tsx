import { createClient } from '@/lib/supabase/server'
import { CalendarCheck, Clock, User } from 'lucide-react'
import { getTodayKST, getKSTDayStartUTC, getKSTDayEndExclusiveUTC } from '@/lib/datetime-kst'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: shop } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', user!.id)
    .single()

  const todayKST = getTodayKST()
  const todayStart = getKSTDayStartUTC(todayKST)
  const todayEnd = getKSTDayEndExclusiveUTC(todayKST)

  const { count: todayCount } = await supabase
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shop!.id)
    .gte('created_at', todayStart)
    .lt('created_at', todayEnd)

  const { data: recentReservations } = await supabase
    .from('reservations')
    .select('id, customer_name, customer_phone, quantity, status, created_at')
    .eq('shop_id', shop!.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const statusLabels: Record<string, string> = {
    pending: '대기',
    confirmed: '확인',
    cancelled: '취소',
    completed: '완료',
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-stone-100 text-stone-500',
    completed: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-stone-900">대시보드</h1>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <CalendarCheck className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-stone-500">오늘의 예약</p>
            <p className="text-2xl font-bold text-stone-900">
              {todayCount ?? 0}
              <span className="ml-1 text-sm font-medium text-stone-400">건</span>
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-stone-700">최근 예약</h2>

        {!recentReservations || recentReservations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center">
            <CalendarCheck className="mx-auto mb-3 h-8 w-8 text-stone-300" />
            <p className="text-sm font-medium text-stone-400">
              아직 예약이 없습니다
            </p>
            <p className="mt-1 text-xs text-stone-300">
              고객이 예약하면 여기에 표시됩니다
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentReservations.map((reservation) => (
              <div
                key={reservation.id}
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                    <User className="h-4 w-4 text-stone-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">
                      {reservation.customer_name}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-stone-400">
                      <Clock className="h-3 w-3" />
                      {new Date(reservation.created_at).toLocaleDateString('ko-KR', {
                        timeZone: 'Asia/Seoul',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      <span>· {reservation.quantity}개</span>
                    </div>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    statusColors[reservation.status] ?? 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {statusLabels[reservation.status] ?? reservation.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
