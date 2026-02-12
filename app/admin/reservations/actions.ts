'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const STATUS_MESSAGES = {
  confirmed: '예약이 확인되었습니다',
  cancelled: '예약이 취소되었습니다',
  completed: '예약이 완료되었습니다',
}

export async function updateReservationStatus(
  reservationId: string,
  newStatus: 'confirmed' | 'cancelled' | 'completed'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('인증이 필요합니다')

  const { data: reservation, error: fetchError } = await supabase
    .from('reservations')
    .select('*, shops!inner(owner_id, name, slug), products(title)')
    .eq('id', reservationId)
    .single()

  if (fetchError || !reservation) {
    throw new Error('예약을 찾을 수 없습니다')
  }

  if (reservation.shops.owner_id !== user.id) {
    throw new Error('권한이 없습니다')
  }

  const { error } = await supabase
    .from('reservations')
    .update({ status: newStatus })
    .eq('id', reservationId)

  if (error) throw new Error('상태 변경에 실패했습니다')

  try {
    const { data: subscription } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('shop_id', reservation.shop_id)
      .eq('customer_phone', reservation.customer_phone)
      .single()

    if (subscription) {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify({
          title: reservation.shops.name,
          body: `${STATUS_MESSAGES[newStatus]} - ${reservation.products.title}`,
          url: `/${reservation.shops.slug}`,
        })
      )
    }
  } catch (error: any) {
    console.error('Push notification failed:', error)
    if (error.statusCode === 410 || error.statusCode === 404) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('shop_id', reservation.shop_id)
        .eq('customer_phone', reservation.customer_phone)
    }
  }

  revalidatePath('/admin/reservations')
  return { success: true }
}
