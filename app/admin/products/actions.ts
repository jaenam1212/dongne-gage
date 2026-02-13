'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sendPushToShop } from '@/lib/push'
import { fromKSTToISOUTC } from '@/lib/datetime-kst'

export async function createProduct(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증이 필요합니다')

  const { data: shop } = await supabase
    .from('shops')
    .select('id, name, slug')
    .eq('owner_id', user.id)
    .single()

  if (!shop) throw new Error('가게를 먼저 등록해주세요')

  const title = formData.get('title') as string
  const price = parseInt(formData.get('price') as string)

  if (!title || title.trim().length === 0) {
    return { error: '상품명을 입력해주세요' }
  }
  if (!price || price <= 0) {
    return { error: '가격은 0원보다 커야 합니다' }
  }
  if (price > 10_000_000) {
    return { error: '상품 금액은 1,000만원을 초과할 수 없습니다' }
  }

  let image_url: string | null = null
  const imageFile = formData.get('image') as File | null
  if (imageFile && imageFile.size > 0) {
    if (imageFile.size > 5 * 1024 * 1024) {
      return { error: '이미지는 5MB 이하만 가능합니다' }
    }
    const fileExt = imageFile.name.split('.').pop()
    const fileName = `${shop.id}-${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, imageFile)

    if (uploadError) {
      return { error: `이미지 업로드에 실패했습니다: ${uploadError.message}` }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName)

    image_url = publicUrl
  }

  const maxQuantityRaw = formData.get('maxQuantity') as string
  const maxPerCustomerRaw = formData.get('maxQuantityPerCustomer') as string
  const deadlineRaw = formData.get('deadline') as string
  const maxQtyNum = maxQuantityRaw ? parseInt(maxQuantityRaw, 10) : NaN
  const max_quantity = Number.isNaN(maxQtyNum) || maxQtyNum <= 0 ? null : maxQtyNum
  const perCustomerNum = maxPerCustomerRaw ? parseInt(maxPerCustomerRaw, 10) : NaN
  const max_quantity_per_customer = Number.isNaN(perCustomerNum) || perCustomerNum < 1 ? null : perCustomerNum
  const deadline = deadlineRaw ? fromKSTToISOUTC(deadlineRaw) : null

  const { error } = await supabase.from('products').insert({
    shop_id: shop.id,
    title: title.trim(),
    description: (formData.get('description') as string) || null,
    price,
    image_url,
    max_quantity,
    max_quantity_per_customer,
    deadline,
    is_active: true,
  })

  if (error) return { error: '상품 등록에 실패했습니다' }

  try {
    await sendPushToShop(shop.id, {
      title: `${shop.name} 새 상품`,
      body: `${title.trim()} - 지금 예약하세요!`,
      url: `/${shop.slug}`,
    })
  } catch (error) {
    console.error('Push notification failed:', error)
  }

  revalidatePath('/admin/products')
  redirect('/admin/products')
}

export async function updateProduct(productId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증이 필요합니다')

  const { data: product } = await supabase
    .from('products')
    .select('*, shops!inner(owner_id)')
    .eq('id', productId)
    .single()

  if (!product || (product.shops as { owner_id: string }).owner_id !== user.id) {
    throw new Error('권한이 없습니다')
  }

  const title = formData.get('title') as string
  const price = parseInt(formData.get('price') as string)

  if (!title || title.trim().length === 0) {
    return { error: '상품명을 입력해주세요' }
  }
  if (!price || price <= 0) {
    return { error: '가격은 0원보다 커야 합니다' }
  }
  if (price > 10_000_000) {
    return { error: '상품 금액은 1,000만원을 초과할 수 없습니다' }
  }

  const maxQuantityRaw = formData.get('maxQuantity') as string
  const maxQtyNum = maxQuantityRaw ? parseInt(maxQuantityRaw, 10) : NaN
  const newMaxQuantity = Number.isNaN(maxQtyNum) || maxQtyNum <= 0 ? null : maxQtyNum

  if (newMaxQuantity !== null && product.reserved_count > newMaxQuantity) {
    return {
      error: `이미 ${product.reserved_count}건 예약되어 있어 수량을 ${newMaxQuantity}로 줄일 수 없습니다`,
    }
  }

  let image_url = product.image_url
  const imageFile = formData.get('image') as File | null
  if (imageFile && imageFile.size > 0) {
    if (imageFile.size > 5 * 1024 * 1024) {
      return { error: '이미지는 5MB 이하만 가능합니다' }
    }
    const fileExt = imageFile.name.split('.').pop()
    const fileName = `${product.shop_id}-${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, imageFile)

    if (uploadError) {
      return { error: `이미지 업로드에 실패했습니다: ${uploadError.message}` }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName)

    image_url = publicUrl
  }

  const maxPerCustomerRaw = formData.get('maxQuantityPerCustomer') as string
  const perCustomerNum = maxPerCustomerRaw ? parseInt(maxPerCustomerRaw, 10) : NaN
  const max_quantity_per_customer = Number.isNaN(perCustomerNum) || perCustomerNum < 1 ? null : perCustomerNum
  const deadlineRaw = formData.get('deadline') as string
  const deadline = deadlineRaw ? fromKSTToISOUTC(deadlineRaw) : null

  const { error } = await supabase
    .from('products')
    .update({
      title: title.trim(),
      description: (formData.get('description') as string) || null,
      price,
      image_url,
      max_quantity: newMaxQuantity,
      max_quantity_per_customer,
      deadline,
    })
    .eq('id', productId)

  if (error) return { error: '상품 수정에 실패했습니다' }

  revalidatePath('/admin/products')
  redirect('/admin/products')
}

export async function toggleProductActive(productId: string, isActive: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증이 필요합니다')

  const { data: shop } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!shop) throw new Error('가게를 찾을 수 없습니다')

  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', productId)
    .eq('shop_id', shop.id)

  if (error) throw error
  revalidatePath('/admin/products')
}

export async function deleteProducts(productIds: string[]) {
  if (!productIds.length) return { error: '삭제할 상품을 선택해주세요' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증이 필요합니다')

  const { data: shop } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!shop) throw new Error('가게를 찾을 수 없습니다')

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('shop_id', shop.id)
    .in('id', productIds)

  if (error) return { error: '삭제에 실패했습니다' }
  revalidatePath('/admin/products')
  return { success: true }
}
