'use server'

import { redirect } from 'next/navigation'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'signup',
  'my-orders',
  'gunggu',
  '123',
])

function validateSlug(slug: string): string | null {
  if (!/^[a-z0-9\-]+$/.test(slug) || slug.length < 1) {
    return '가게 URL은 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.'
  }
  if (RESERVED_SLUGS.has(slug)) {
    return '해당 URL은 시스템 예약어라 사용할 수 없습니다. 다른 URL을 입력해주세요.'
  }
  return null
}

export async function checkSlugAvailability(slugInput: string) {
  const slug = (slugInput || '').trim().toLowerCase()
  if (!slug) {
    return { error: '가게 URL을 입력해주세요.' }
  }

  const slugValidationError = validateSlug(slug)
  if (slugValidationError) {
    return { error: slugValidationError }
  }

  const admin = createServiceRoleClient()
  const { data: existingShop } = await admin
    .from('shops')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingShop) {
    return { error: '이미 사용중인 URL입니다. 다른 URL을 입력해주세요.' }
  }

  return { success: '사용 가능한 URL입니다.', slug }
}

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const shopName = (formData.get('shopName') as string).trim()
  const slug = (formData.get('slug') as string).trim().toLowerCase()
  const slugCheckedSlug = ((formData.get('slugCheckedSlug') as string) || '').trim().toLowerCase()
  const phone = (formData.get('phone') as string)?.trim() || null

  if (!email || !password || !shopName || !slug) {
    return { error: '필수 항목을 입력해주세요' }
  }

  if (password.length < 8) {
    return { error: '비밀번호는 최소 8자 이상이어야 합니다' }
  }

  const slugValidationError = validateSlug(slug)
  if (slugValidationError) {
    return { error: slugValidationError }
  }

  if (slugCheckedSlug !== slug) {
    return { error: '가입 전에 가게 URL 중복확인을 완료해주세요.' }
  }

  const admin = createServiceRoleClient()

  // Slug 중복 검사 (RLS 없이 전체 조회)
  const { data: existingShop } = await admin
    .from('shops')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingShop) {
    return { error: '이미 사용중인 URL입니다. 다른 URL을 입력해주세요.' }
  }

  const supabase = await createClient()

  // signUp 사용. 이메일 한도 방지: Supabase 대시보드 → Authentication → Providers → Email → "Confirm email" 끄기
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError || !authData.user) {
    const msg = authError?.message ?? '가입에 실패했습니다'
    if (/email rate limit|rate limit exceeded/i.test(msg)) {
      return {
        error:
          '이메일 발송 한도 초과입니다. Supabase 대시보드에서 Authentication → Providers → Email → "Confirm email"을 끄고, 1시간 후 다시 시도해 주세요.',
      }
    }
    if (/already registered|already exists|duplicate/i.test(msg)) {
      return { error: '이미 가입된 이메일입니다. 로그인해 주세요.' }
    }
    return { error: msg }
  }

  // 가입 직후 쿠키에 세션 없어 RLS 통과 위해 확인 처리
  await admin.auth.admin.updateUserById(authData.user.id, { email_confirm: true })

  const trialStartedAt = new Date()
  const trialEndsAt = new Date(trialStartedAt)
  trialEndsAt.setMonth(trialEndsAt.getMonth() + 3)

  const { error: shopError } = await admin.from('shops').insert({
    owner_id: authData.user.id,
    slug,
    name: shopName,
    phone,
    is_active: true,
    trial_started_at: trialStartedAt.toISOString(),
    trial_ends_at: trialEndsAt.toISOString(),
    billing_status: 'trialing',
    plan_code: 'starter_monthly',
    read_only_mode: false,
    billing_customer_key: `shop-${authData.user.id}`,
    billing_updated_at: trialStartedAt.toISOString(),
  })

  if (shopError) {
    return { error: `가게 생성에 실패했습니다: ${shopError.message}` }
  }

  await supabase.auth.signInWithPassword({ email, password })

  redirect('/admin/dashboard')
}
