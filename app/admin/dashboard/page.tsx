import { createClient } from '@/lib/supabase/server'
import { CalendarCheck, Clock, User } from 'lucide-react'
import { getTodayKST, getKSTDayStartUTC, getKSTDayEndExclusiveUTC } from '@/lib/datetime-kst'
import { getShopBillingSnapshot } from '@/lib/billing'
import Link from 'next/link'
import { BillingQuickPayButton } from '@/components/admin/billing-quick-pay-button'

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

  const billing = user ? await getShopBillingSnapshot(supabase, user.id) : null

  const todayKST = getTodayKST()
  const todayStart = getKSTDayStartUTC(todayKST)
  const todayEnd = getKSTDayEndExclusiveUTC(todayKST)

  const { count: todayCount } = await supabase
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('shop_id', shop!.id)
    .gte('created_at', todayStart)
    .lt('created_at', todayEnd)

  const { data: todayUsageEvents } = await supabase
    .from('usage_events')
    .select('event_type, visitor_id, path, created_at')
    .eq('shop_id', shop!.id)
    .gte('created_at', todayStart)
    .lt('created_at', todayEnd)
    .order('created_at', { ascending: false })
    .limit(300)

  const uniqueVisitors = new Set(
    (todayUsageEvents ?? [])
      .filter((event) => event.event_type === 'page_view' && event.visitor_id)
      .map((event) => event.visitor_id as string)
  ).size

  const todayPageViews = (todayUsageEvents ?? []).filter(
    (event) => event.event_type === 'page_view'
  ).length

  const todayReservationEvents = (todayUsageEvents ?? []).filter(
    (event) => event.event_type === 'reservation_created'
  ).length

  const pathCountMap = new Map<string, number>()
  for (const event of todayUsageEvents ?? []) {
    if (event.event_type !== 'page_view' || !event.path) continue
    pathCountMap.set(event.path, (pathCountMap.get(event.path) ?? 0) + 1)
  }
  const popularPaths = Array.from(pathCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

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

  const billingQuickPayLabel = billing?.isSystemOwner
    ? '시스템 오너 과금 면제'
    : billing?.readOnlyMode
    ? '결제 하기'
    : billing?.billingStatus === 'active' && billing.daysUntilTrialEnd < 0
    ? '정기결제 이용중'
    : billing?.paidScheduledAfterTrial
    ? '결제 등록 완료'
    : '미리 결제 등록하기'

  const billingQuickPayDisabled =
    !!billing?.isSystemOwner ||
    (billing?.billingStatus === 'active' && billing.daysUntilTrialEnd < 0) ||
    !!billing?.paidScheduledAfterTrial

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-stone-900">대시보드</h1>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-stone-500">결제 상태</p>
            <p className="mt-1 text-lg font-bold text-stone-900">
              {billing?.billingStatus === 'active'
                ? '유료 이용중'
                : billing?.readOnlyMode
                ? '결제 필요 (읽기 전용)'
                : '무료체험 이용중'}
            </p>
            {billing && (
              <p className="mt-1 text-sm text-stone-500">
                {billing.daysUntilTrialEnd >= 0
                  ? billing.paidScheduledAfterTrial
                    ? `무료체험 종료까지 ${billing.daysUntilTrialEnd}일 (선결제 완료)`
                    : `무료체험 종료까지 ${billing.daysUntilTrialEnd}일`
                  : '무료체험이 종료되었습니다'}
                {billing.nextBillingAt
                  ? ` · 다음 결제 ${new Date(billing.nextBillingAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`
                  : ''}
              </p>
            )}
          </div>
          <div className="shrink-0">
            <BillingQuickPayButton label={billingQuickPayLabel} disabled={billingQuickPayDisabled} />
          </div>
        </div>
        <div className="mt-3">
          <Link href="/admin/billing" className="text-xs font-semibold text-stone-700 underline underline-offset-2">
            결제 상세 설정으로 이동
          </Link>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-4">
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
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-stone-500">오늘 방문자</p>
          <p className="text-2xl font-bold text-stone-900">
            {uniqueVisitors}
            <span className="ml-1 text-sm font-medium text-stone-400">명</span>
          </p>
          <p className="mt-1 text-xs text-stone-400">페이지뷰 {todayPageViews}회</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-stone-500">오늘 예약 완료 이벤트</p>
          <p className="text-2xl font-bold text-stone-900">
            {todayReservationEvents}
            <span className="ml-1 text-sm font-medium text-stone-400">회</span>
          </p>
          <p className="mt-1 text-xs text-stone-400">예약 전환 추적</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-stone-500">플랜 상태</p>
          <p className="text-2xl font-bold text-stone-900">
            {billing?.billingStatus === 'active'
              ? '유료'
              : billing?.readOnlyMode
              ? '만료'
              : '무료'}
          </p>
          {billing && (
            <p className="mt-1 text-xs text-stone-400">
              {billing.daysUntilTrialEnd >= 0
                ? `무료체험 ${billing.daysUntilTrialEnd}일 남음`
                : '무료체험 종료'}
            </p>
          )}
          <Link href="/admin/billing" className="mt-2 inline-block text-xs font-semibold text-stone-700 underline underline-offset-2">
            결제 관리
          </Link>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-stone-700">오늘 많이 본 페이지</h2>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          {popularPaths.length === 0 ? (
            <p className="text-sm text-stone-400">아직 수집된 방문 로그가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {popularPaths.map(([path, count]) => (
                <div key={path} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2">
                  <p className="text-xs text-stone-700 truncate pr-3">{path}</p>
                  <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                    {count}회
                  </span>
                </div>
              ))}
            </div>
          )}
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
