'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateShop(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: shop } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!shop) throw new Error('Shop not found')

  let logo_url = formData.get('current_logo_url') as string | null
  const logoFile = formData.get('logo') as File | null

  if (logoFile && logoFile.size > 0) {
    const fileExt = logoFile.name.split('.').pop()
    const fileName = `${shop.id}-${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('shop-logos')
      .upload(fileName, logoFile, { upsert: true })

    if (uploadError) throw uploadError

    const {
      data: { publicUrl },
    } = supabase.storage.from('shop-logos').getPublicUrl(fileName)

    logo_url = publicUrl
  }

  const { error } = await supabase
    .from('shops')
    .update({
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
      logo_url,
      kakao_channel_url: formData.get('kakao_channel_url') as string,
    })
    .eq('id', shop.id)

  if (error) throw error

  revalidatePath('/admin', 'layout')
  return { success: true }
}
