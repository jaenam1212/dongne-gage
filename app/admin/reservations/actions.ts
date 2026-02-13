'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import webpush from 'web-push'

function ensureVapidDetails(): boolean {
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (subject && publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    return true
  }
  return false
}

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

    if (subscription && ensureVapidDetails()) {
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

export async function updateReservationsStatusBulk(
  reservationIds: string[],
  newStatus: 'confirmed' | 'cancelled' | 'completed'
) {
  if (reservationIds.length === 0) {
    return { error: '선택된 예약이 없습니다' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증이 필요합니다')

  const { data: shop } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!shop) throw new Error('가게를 찾을 수 없습니다')

  // 상태별 허용: 취소→완료만 막고, 완료→취소(환불 등)는 허용
  const allowedCurrentStatuses: Record<string, ('pending' | 'confirmed' | 'cancelled' | 'completed')[]> = {
    confirmed: ['pending'],
    cancelled: ['pending', 'confirmed', 'completed'], // 완료→취소(환불) 허용
    completed: ['confirmed'],
  }
  const allowed = allowedCurrentStatuses[newStatus]

  const { error } = await supabase
    .from('reservations')
    .update({ status: newStatus })
    .eq('shop_id', shop.id)
    .in('id', reservationIds)
    .in('status', allowed)

  if (error) throw new Error('일괄 상태 변경에 실패했습니다')

  revalidatePath('/admin/reservations')
  return { success: true }
}
