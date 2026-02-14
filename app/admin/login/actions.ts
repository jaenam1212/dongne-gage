'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    const msg = error.message
    const rateLimitMatch = msg.match(/after (\d+) seconds?/i)
    if (rateLimitMatch) {
      return { error: `보안을 위해 ${rateLimitMatch[1]}초 후에 다시 시도해 주세요.` }
    }
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
  }

  revalidatePath('/admin', 'layout')
  redirect('/admin/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  if (local.length <= 2) return `${local[0] ?? '*'}*@${domain}`
  return `${local.slice(0, 2)}***@${domain}`
}

export async function findLoginId(formData: FormData) {
  const shopName = (formData.get('shopName') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()

  if (!shopName || !phone) {
    return { error: '가게명과 전화번호를 입력해주세요' }
  }

  const admin = createServiceRoleClient()
  const normalizedPhone = phone.replace(/[^0-9]/g, '')

  const { data: shops, error: shopError } = await admin
    .from('shops')
    .select('owner_id, phone')
    .eq('name', shopName)
    .order('created_at', { ascending: false })
    .limit(20)

  if (shopError) {
    return { error: '아이디 조회 중 오류가 발생했습니다' }
  }

  const matched = (shops ?? []).find((shop) => {
    const shopPhone = String(shop.phone ?? '').replace(/[^0-9]/g, '')
    return shopPhone === normalizedPhone
  })

  if (!matched?.owner_id) {
    return { error: '일치하는 계정을 찾을 수 없습니다' }
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(matched.owner_id)
  if (userError || !userData.user?.email) {
    return { error: '일치하는 계정을 찾을 수 없습니다' }
  }

  return {
    success: `가입 이메일: ${maskEmail(userData.user.email)}`,
  }
}

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get('email') as string)?.trim()
  if (!email) {
    return { error: '이메일을 입력해주세요' }
  }

  const supabase = await createClient()
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/admin/reset-password`,
  })

  if (error) {
    const msg = error.message ?? '비밀번호 재설정 요청에 실패했습니다'
    if (/rate limit|too many/i.test(msg)) {
      return { error: '요청이 많습니다. 잠시 후 다시 시도해주세요.' }
    }
    return { error: '비밀번호 재설정 요청에 실패했습니다' }
  }

  return { success: '비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해주세요.' }
}
