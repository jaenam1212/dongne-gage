'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const shopName = (formData.get('shopName') as string).trim()
  const slug = (formData.get('slug') as string).trim()
  const phone = (formData.get('phone') as string)?.trim() || null

  if (!email || !password || !shopName || !slug) {
    return { error: '필수 항목을 입력해주세요' }
  }

  if (password.length < 8) {
    return { error: '비밀번호는 최소 8자 이상이어야 합니다' }
  }

  const supabase = await createClient()

  // Check slug uniqueness
  const { data: existingShop } = await supabase
    .from('shops')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existingShop) {
    return { error: '이미 사용중인 주소입니다. 다른 주소를 입력해주세요.' }
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError || !authData.user) {
    return { error: authError?.message || '가입에 실패했습니다' }
  }

  // Create shop
  const { error: shopError } = await supabase.from('shops').insert({
    owner_id: authData.user.id,
    slug,
    name: shopName,
    phone,
    is_active: true,
  })

  if (shopError) {
    return { error: '가게 생성에 실패했습니다' }
  }

  redirect('/admin/dashboard')
}
