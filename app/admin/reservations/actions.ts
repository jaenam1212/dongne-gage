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

function mapTransitionError(message?: string): string {
  if (!message) return '상태 변경에 실패했습니다'
  if (message.includes('FORBIDDEN')) return '권한이 없습니다'
  if (message.includes('RESERVATION_NOT_FOUND')) return '예약을 찾을 수 없습니다'
  if (message.includes('INVALID_TRANSITION')) return '허용되지 않는 상태 변경입니다'
  if (message.includes('STOCK_EXCEEDED')) return '재고가 부족하여 상태를 변경할 수 없습니다'
  if (message.includes('PER_CUSTOMER_LIMIT')) return '1인당 구매 제한으로 상태를 변경할 수 없습니다'
  return '상태 변경에 실패했습니다'
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

  const { error } = await supabase.rpc('transition_reservation_status', {
    p_reservation_id: reservationId,
    p_next_status: newStatus,
    p_actor: user.id,
  })

  if (error) throw new Error(mapTransitionError(error.message))

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
  } catch (error: unknown) {
    console.error('Push notification failed:', error)
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      (error.statusCode === 410 || error.statusCode === 404)
    ) {
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

  const { data: ownedReservations, error: ownedReservationsError } = await supabase
    .from('reservations')
    .select('id')
    .eq('shop_id', shop.id)
    .in('id', reservationIds)

  if (ownedReservationsError) {
    throw new Error('예약 조회에 실패했습니다')
  }

  const ownedIds = new Set((ownedReservations ?? []).map((row) => row.id))
  const targets = reservationIds.filter((id) => ownedIds.has(id))

  if (targets.length === 0) {
    return { error: '처리 가능한 예약이 없습니다' }
  }

  let successCount = 0
  const failures: string[] = []

  for (const reservationId of targets) {
    const { error } = await supabase.rpc('transition_reservation_status', {
      p_reservation_id: reservationId,
      p_next_status: newStatus,
      p_actor: user.id,
    })

    if (error) {
      failures.push(mapTransitionError(error.message))
      continue
    }
    successCount++
  }

  if (successCount === 0) {
    return { error: failures[0] ?? '일괄 상태 변경에 실패했습니다' }
  }

  if (failures.length > 0) {
    const uniqueFailures = [...new Set(failures)]
    revalidatePath('/admin/reservations')
    return {
      error: `${targets.length}건 중 ${successCount}건 처리됨. 실패 사유: ${uniqueFailures.join(', ')}`,
    }
  }

  revalidatePath('/admin/reservations')
  return { success: true }
}
