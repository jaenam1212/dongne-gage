import { createClient } from '@/lib/supabase/server'

export const BILLING_REMINDER_DAYS = [30, 20, 1] as const
export const READ_ONLY_MESSAGE = '무료체험이 종료되어 결제가 필요합니다.'

export type ShopBillingSnapshot = {
  shopId: string
  isSystemOwner: boolean
  trialEndsAt: string
  trialStartedAt: string
  billingStatus: 'trialing' | 'active' | 'past_due' | 'cancelled'
  readOnlyMode: boolean
  planCode: string
  nextBillingAt: string | null
  daysUntilTrialEnd: number
  shouldShowReminder: boolean
  reminderDay: number | null
  paidScheduledAfterTrial: boolean
}

function diffDaysCeil(from: Date, to: Date) {
  const diffMs = to.getTime() - from.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export async function getShopBillingSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string
): Promise<ShopBillingSnapshot | null> {
  const { data: shop } = await supabase
    .from('shops')
    .select('id, is_system_owner, trial_ends_at, trial_started_at, billing_status, read_only_mode, plan_code, next_billing_at')
    .eq('owner_id', ownerId)
    .single()

  if (!shop) return null

  const { data: subscription } = await supabase
    .from('shop_subscriptions')
    .select('status, current_period_start, current_period_end')
    .eq('shop_id', shop.id)
    .maybeSingle()

  const now = new Date()
  const trialEnd = new Date(shop.trial_ends_at)
  const daysUntilTrialEnd = diffDaysCeil(now, trialEnd)
  const isSystemOwner = !!shop.is_system_owner
  const subStatus = typeof subscription?.status === 'string' ? subscription.status : null
  const subStart = subscription?.current_period_start ? new Date(subscription.current_period_start) : null
  const subEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null
  const hasValidSubscription = Boolean(
    subStatus === 'active' && ((subEnd && subEnd >= now) || (subStart && subStart > now))
  )
  const paidScheduledAfterTrial =
    !isSystemOwner &&
    daysUntilTrialEnd >= 0 &&
    hasValidSubscription &&
    !!subStart &&
    subStart > now

  let effectiveBillingStatus: ShopBillingSnapshot['billingStatus']
  let computedReadOnly: boolean

  if (isSystemOwner) {
    effectiveBillingStatus = 'active'
    computedReadOnly = false
  } else if (daysUntilTrialEnd >= 0) {
    // 무료기간에는 결제 여부와 무관하게 무료 상태 유지
    effectiveBillingStatus = 'trialing'
    computedReadOnly = false
  } else if (hasValidSubscription) {
    effectiveBillingStatus = 'active'
    computedReadOnly = false
  } else {
    effectiveBillingStatus = 'past_due'
    computedReadOnly = true
  }

  if (computedReadOnly !== !!shop.read_only_mode || (!isSystemOwner && effectiveBillingStatus !== shop.billing_status)) {
    await supabase
      .from('shops')
      .update({
        read_only_mode: computedReadOnly,
        billing_status: isSystemOwner ? shop.billing_status : effectiveBillingStatus,
        billing_updated_at: new Date().toISOString(),
      })
      .eq('id', shop.id)
  }

  const reminderDay = BILLING_REMINDER_DAYS.includes(daysUntilTrialEnd as (typeof BILLING_REMINDER_DAYS)[number])
    ? daysUntilTrialEnd
    : null

  return {
    shopId: shop.id,
    isSystemOwner,
    trialEndsAt: shop.trial_ends_at,
    trialStartedAt: shop.trial_started_at,
    billingStatus: effectiveBillingStatus,
    readOnlyMode: computedReadOnly,
    planCode: shop.plan_code ?? 'starter_monthly',
    nextBillingAt: shop.next_billing_at ?? null,
    daysUntilTrialEnd,
    shouldShowReminder: !isSystemOwner && daysUntilTrialEnd >= 0 && reminderDay !== null,
    reminderDay: isSystemOwner ? null : reminderDay,
    paidScheduledAfterTrial,
  }
}

export async function assertShopWritable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string
): Promise<{ shopId: string }> {
  const snapshot = await getShopBillingSnapshot(supabase, ownerId)
  if (!snapshot) {
    throw new Error('가게를 찾을 수 없습니다')
  }

  if (!snapshot.isSystemOwner && (snapshot.readOnlyMode || (snapshot.daysUntilTrialEnd < 0 && snapshot.billingStatus !== 'active'))) {
    throw new Error(READ_ONLY_MESSAGE)
  }

  return { shopId: snapshot.shopId }
}
