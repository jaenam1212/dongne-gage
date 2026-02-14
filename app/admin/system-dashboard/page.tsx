import { redirect } from 'next/navigation'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export default async function SystemDashboardPage() {
  const supabase = await createClient()
  const admin = createServiceRoleClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { data: myShop } = await supabase
    .from('shops')
    .select('id, is_system_owner, name')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!myShop?.is_system_owner) {
    redirect('/admin/dashboard')
  }

  const [{ count: sellerCount }, { count: productCount }, { count: reservationCount }, { count: shopCount }] =
    await Promise.all([
      admin.from('shops').select('*', { head: true, count: 'exact' }).eq('is_active', true),
      admin.from('products').select('*', { head: true, count: 'exact' }),
      admin.from('reservations').select('*', { head: true, count: 'exact' }),
      admin.from('shops').select('*', { head: true, count: 'exact' }),
    ])

  const { data: latestReservations } = await admin
    .from('reservations')
    .select('id, customer_name, customer_phone, status, created_at, products(title), shops(name)')
    .order('created_at', { ascending: false })
    .limit(20)

  const uniqueCustomers = new Set(
    (latestReservations ?? [])
      .map((item) => item.customer_phone)
      .filter((phone): phone is string => !!phone)
  ).size

  const statusCount = (latestReservations ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-900">시스템 대시보드</h1>
        <p className="mt-1 text-sm text-stone-500">
          시스템 오너 전용 통계입니다. ({myShop.name})
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-stone-500">활성 판매자</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">{sellerCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-stone-500">전체 가게 수</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">{shopCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-stone-500">전체 상품 수</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">{productCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-stone-500">전체 예약 수</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">{reservationCount ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-800">최근 고객 지표</h2>
          <p className="mt-2 text-sm text-stone-600">
            최근 예약 20건 기준 고객 수: <span className="font-semibold text-stone-900">{uniqueCustomers}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-800">최근 예약 상태 분포</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(statusCount).length === 0 ? (
              <p className="text-sm text-stone-400">데이터 없음</p>
            ) : (
              Object.entries(statusCount).map(([status, count]) => (
                <span key={status} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700">
                  {status}: {count}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-stone-800">최근 예약 로그 (전역)</h2>
        {!latestReservations || latestReservations.length === 0 ? (
          <p className="text-sm text-stone-400">예약 로그가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs font-semibold text-stone-500">
                  <th className="px-3 py-2">시간</th>
                  <th className="px-3 py-2">가게</th>
                  <th className="px-3 py-2">상품</th>
                  <th className="px-3 py-2">고객</th>
                  <th className="px-3 py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {latestReservations.map((row) => (
                  <tr key={row.id} className="border-b border-stone-100 text-stone-700">
                    <td className="px-3 py-2 text-xs">
                      {new Date(row.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                    </td>
                    <td className="px-3 py-2">{(row.shops as { name?: string } | null)?.name ?? '-'}</td>
                    <td className="px-3 py-2">{(row.products as { title?: string } | null)?.title ?? '-'}</td>
                    <td className="px-3 py-2">
                      {row.customer_name}
                      <span className="ml-1 text-xs text-stone-400">
                        ({row.customer_phone})
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
