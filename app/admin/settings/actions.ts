'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type UpdateShopResult = {
  success?: boolean
  error?: string
}

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024

function mapStorageError(message?: string): string {
  if (!message) return '로고 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.'
  if (message.includes('Bucket not found')) return '로고 저장소가 준비되지 않았습니다. 관리자에게 문의해주세요.'
  if (message.includes('mime')) return '지원하지 않는 이미지 형식입니다. JPG/PNG/WEBP만 업로드해주세요.'
  if (message.includes('row-level security') || message.includes('permission')) {
    return '로고 업로드 권한이 없습니다. 다시 로그인 후 시도해주세요.'
  }
  return '로고 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.'
}

function normalizeOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function updateShop(formData: FormData): Promise<UpdateShopResult> {
  let supabase: Awaited<ReturnType<typeof createClient>>
  try {
    supabase = await createClient()
  } catch (error) {
    console.error('createClient failed in updateShop:', error)
    return { error: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '인증이 필요합니다. 다시 로그인해주세요.' }

  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (shopError || !shop) {
    console.error('Shop lookup failed in updateShop:', shopError)
    return { error: '가게 정보를 찾을 수 없습니다.' }
  }

  let logo_url = formData.get('current_logo_url') as string | null
  const logoFile = formData.get('logo') as File | null

  if (logoFile && logoFile.size > 0) {
    if (logoFile.size > MAX_LOGO_SIZE_BYTES) {
      return { error: '로고 이미지는 2MB 이하만 업로드할 수 있습니다.' }
    }

    if (!ALLOWED_LOGO_TYPES.includes(logoFile.type)) {
      return { error: '지원하지 않는 이미지 형식입니다. JPG/PNG/WEBP만 업로드해주세요.' }
    }

    const fileExt = logoFile.name.split('.').pop()
    const safeExt = fileExt && fileExt.trim().length > 0 ? fileExt : 'png'
    const fileName = `${shop.id}-${Date.now()}.${safeExt}`
    const { error: uploadError } = await supabase.storage
      .from('shop-logos')
      .upload(fileName, logoFile, { upsert: true })

    if (uploadError) {
      console.error('Logo upload failed:', uploadError)
      return { error: mapStorageError(uploadError.message) }
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('shop-logos').getPublicUrl(fileName)

    logo_url = publicUrl
  }

  const { error } = await supabase
    .from('shops')
    .update({
      name: (formData.get('name') as string)?.trim(),
      description: normalizeOptionalString(formData.get('description')),
      phone: normalizeOptionalString(formData.get('phone')),
      address: normalizeOptionalString(formData.get('address')),
      logo_url,
    })
    .eq('id', shop.id)

  if (error) {
    console.error('Shop update failed:', error)
    return { error: '가게 정보 저장에 실패했습니다. 잠시 후 다시 시도해주세요.' }
  }

  revalidatePath('/admin', 'layout')
  return { success: true }
}
