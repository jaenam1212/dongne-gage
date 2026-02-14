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
}

function diffDaysCeil(from: Date, to: Date) {
  const diffMs = to.getTime() - from.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function asBillingStatus(value: string | null | undefined): ShopBillingSnapshot['billingStatus'] {
  if (value === 'active' || value === 'past_due' || value === 'cancelled') return value
  return 'trialing'
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

  const now = new Date()
  const trialEnd = new Date(shop.trial_ends_at)
  const daysUntilTrialEnd = diffDaysCeil(now, trialEnd)
  const isSystemOwner = !!shop.is_system_owner
  const computedReadOnly = isSystemOwner
    ? false
    : daysUntilTrialEnd < 0 && asBillingStatus(shop.billing_status) !== 'active'
  const effectiveBillingStatus = isSystemOwner ? 'active' : asBillingStatus(shop.billing_status)

  if (computedReadOnly !== !!shop.read_only_mode || (!isSystemOwner && effectiveBillingStatus !== shop.billing_status)) {
    await supabase
      .from('shops')
      .update({
        read_only_mode: computedReadOnly,
        billing_status: isSystemOwner ? shop.billing_status : computedReadOnly ? 'past_due' : effectiveBillingStatus,
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
