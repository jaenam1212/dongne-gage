import { createClient } from '@/lib/supabase/server'
import { ReservationList } from './reservation-list'
import { redirect } from 'next/navigation'

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string }>
}) {
  const { date, status } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('id, slug')
    .eq('owner_id', user.id)
    .single()

  if (!shop) {
    redirect('/admin/login')
  }

  let query = supabase
    .from('reservations')
    .select('*, products(title, price, image_url)')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })

  if (date === 'today') {
    const today = new Date().toISOString().split('T')[0]
    query = query.gte('created_at', today)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: reservations } = await query

  return <ReservationList reservations={reservations ?? []} shopSlug={shop.slug} />
}
