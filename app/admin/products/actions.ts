'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sendPushToShop } from '@/lib/push'
import { fromKSTToISOUTC } from '@/lib/datetime-kst'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
type ProductOptionGroup = { name: string; values: string[]; required: boolean }

function parseProductOptionsJson(raw: string): { groups: ProductOptionGroup[]; error?: string } {
  const text = raw.trim()
  if (!text) return { groups: [] }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { groups: [], error: '옵션 데이터 형식이 올바르지 않습니다' }
  }

  if (!Array.isArray(parsed)) {
    return { groups: [], error: '옵션 데이터 형식이 올바르지 않습니다' }
  }

  const groups: ProductOptionGroup[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      return { groups: [], error: '옵션 데이터 형식이 올바르지 않습니다' }
    }
    const option = item as { name?: unknown; values?: unknown; required?: unknown }
    const name = typeof option.name === 'string' ? option.name.trim() : ''
    const values = Array.isArray(option.values)
      ? option.values
          .filter((v): v is string => typeof v === 'string')
          .map((v) => v.trim())
          .filter(Boolean)
      : []
    const required = option.required !== false

    if (!name || values.length === 0) {
      return { groups: [], error: '옵션명과 값을 입력해주세요' }
    }
    groups.push({
      name,
      values: Array.from(new Set(values)),
      required,
    })
  }

  return { groups }
}

function parseProductOptionsRaw(raw: string): { groups: ProductOptionGroup[]; error?: string } {
  const text = raw.trim()
  if (!text) return { groups: [] }

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const groups: ProductOptionGroup[] = []

  for (const line of lines) {
    const [left, right] = line.split(':')
    if (!left || !right) {
      return {
        groups: [],
        error: '옵션 형식이 올바르지 않습니다. 예: 사이즈: S, M, L',
      }
    }

    const optionNameRaw = left.trim()
    const required = !optionNameRaw.endsWith('(선택)')
    const name = required
      ? optionNameRaw
      : optionNameRaw.replace(/\(선택\)\s*$/, '').trim()

    const values = right
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

    if (!name || values.length < 1) {
      return {
        groups: [],
        error: '옵션명과 값을 입력해주세요. 예: 컬러(선택): 블랙, 화이트',
      }
    }

    const dedupedValues = Array.from(new Set(values))
    groups.push({ name, values: dedupedValues, required })
  }

  return { groups }
}

function getImageFilesFromForm(formData: FormData): File[] {
  const files = formData
    .getAll('images')
    .filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length > 0) return files

  const fallback = formData.get('image')
  if (fallback instanceof File && fallback.size > 0) return [fallback]
  return []
}

async function uploadProductImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  productId: string,
  files: File[],
  startOrder: number
): Promise<{ urls: string[]; error?: string }> {
  const urls: string[] = []
  const rows: { product_id: string; shop_id: string; image_url: string; sort_order: number }[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.size > MAX_IMAGE_SIZE) {
      return { urls: [], error: '이미지는 5MB 이하만 업로드할 수 있습니다' }
    }
    if (!file.type.startsWith('image/')) {
      return { urls: [], error: '이미지 파일만 업로드할 수 있습니다' }
    }

    const ext = file.name.split('.').pop()?.trim() || 'png'
    const fileName = `${shopId}-${productId}-${Date.now()}-${i}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file)

    if (uploadError) {
      return { urls: [], error: `이미지 업로드에 실패했습니다: ${uploadError.message}` }
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('product-images').getPublicUrl(fileName)

    urls.push(publicUrl)
    rows.push({
      product_id: productId,
      shop_id: shopId,
      image_url: publicUrl,
      sort_order: startOrder + i,
    })
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('product_images').insert(rows)
    if (insertError) {
      return { urls: [], error: '이미지 메타데이터 저장에 실패했습니다' }
    }
  }

  return { urls }
}

async function resolveInventoryLinkInput(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopId: string,
  formData: FormData
): Promise<{
  enabled: boolean
  inventoryItemId: string | null
  consumePerSale: number
  error?: string
}> {
  const enabled = (formData.get('inventoryLinkEnabled') as string) === 'true'
  const inventoryItemIdRaw = (formData.get('inventoryItemId') as string)?.trim()
  const consumeRaw = (formData.get('inventoryConsumePerSale') as string)?.trim()
  const consumeParsed = consumeRaw ? Number.parseInt(consumeRaw, 10) : 1
  const consumePerSale = Number.isNaN(consumeParsed) || consumeParsed < 1 ? 1 : consumeParsed

  if (!enabled) {
    return { enabled: false, inventoryItemId: null, consumePerSale }
  }

  if (!inventoryItemIdRaw) {
    return {
      enabled: true,
      inventoryItemId: null,
      consumePerSale,
      error: '재고 연동을 사용하려면 재고 항목을 선택해주세요',
    }
  }

  const { data: inventoryItem, error } = await supabase
    .from('inventory_items')
    .select('id, is_active')
    .eq('id', inventoryItemIdRaw)
    .eq('shop_id', shopId)
    .single()

  if (error || !inventoryItem) {
    return {
      enabled: true,
      inventoryItemId: null,
      consumePerSale,
      error: '선택한 재고 항목을 찾을 수 없습니다',
    }
  }

  if (!inventoryItem.is_active) {
    return {
      enabled: true,
      inventoryItemId: null,
      consumePerSale,
      error: '비활성 재고 항목은 연동할 수 없습니다',
    }
  }

  return {
    enabled: true,
    inventoryItemId: inventoryItem.id,
    consumePerSale,
  }
}

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

  const imageFiles = getImageFilesFromForm(formData)
  let image_url: string | null = null

  const maxQuantityRaw = formData.get('maxQuantity') as string
  const maxPerCustomerRaw = formData.get('maxQuantityPerCustomer') as string
  const deadlineRaw = formData.get('deadline') as string
  const maxQtyNum = maxQuantityRaw ? parseInt(maxQuantityRaw, 10) : NaN
  const max_quantity = Number.isNaN(maxQtyNum) || maxQtyNum <= 0 ? null : maxQtyNum
  const perCustomerNum = maxPerCustomerRaw ? parseInt(maxPerCustomerRaw, 10) : NaN
  const max_quantity_per_customer = Number.isNaN(perCustomerNum) || perCustomerNum < 1 ? null : perCustomerNum
  const deadline = deadlineRaw ? fromKSTToISOUTC(deadlineRaw) : null

  const inventoryLinkInput = await resolveInventoryLinkInput(supabase, shop.id, formData)
  if (inventoryLinkInput.error) {
    return { error: inventoryLinkInput.error }
  }
  const optionsJsonRaw = (formData.get('productOptionsJson') as string) || ''
  const optionsParsed = optionsJsonRaw.trim()
    ? parseProductOptionsJson(optionsJsonRaw)
    : parseProductOptionsRaw((formData.get('productOptionsRaw') as string) || '')
  if (optionsParsed.error) {
    return { error: optionsParsed.error }
  }

  const { data: insertedProduct, error } = await supabase
    .from('products')
    .insert({
      shop_id: shop.id,
      title: title.trim(),
      description: (formData.get('description') as string) || null,
      price,
      image_url: null,
      max_quantity,
      max_quantity_per_customer,
      deadline,
      option_groups: optionsParsed.groups.length > 0 ? optionsParsed.groups : null,
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !insertedProduct) return { error: '상품 등록에 실패했습니다' }

  if (imageFiles.length > 0) {
    const uploadResult = await uploadProductImages(
      supabase,
      shop.id,
      insertedProduct.id,
      imageFiles,
      0
    )

    if (uploadResult.error) {
      await supabase.from('products').delete().eq('id', insertedProduct.id).eq('shop_id', shop.id)
      return { error: uploadResult.error }
    }

    image_url = uploadResult.urls[0] ?? null
    if (image_url) {
      await supabase.from('products').update({ image_url }).eq('id', insertedProduct.id)
    }
  }

  if (inventoryLinkInput.enabled && inventoryLinkInput.inventoryItemId) {
    const { error: linkError } = await supabase
      .from('product_inventory_links')
      .upsert(
        {
          product_id: insertedProduct.id,
          inventory_item_id: inventoryLinkInput.inventoryItemId,
          consume_per_sale: inventoryLinkInput.consumePerSale,
          is_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'product_id,inventory_item_id' }
      )

    if (linkError) {
      return { error: '상품은 등록되었지만 재고 연동 저장에 실패했습니다' }
    }
  }

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

  const imageFiles = getImageFilesFromForm(formData)
  let image_url = product.image_url

  const { data: existingImages } = await supabase
    .from('product_images')
    .select('id, image_url')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })

  const existingCount = existingImages?.length ?? 0
  if (imageFiles.length > 0) {
    const uploadResult = await uploadProductImages(
      supabase,
      product.shop_id,
      productId,
      imageFiles,
      existingCount
    )
    if (uploadResult.error) {
      return { error: uploadResult.error }
    }
    if (!image_url) {
      image_url = uploadResult.urls[0] ?? null
    }
  }

  const maxPerCustomerRaw = formData.get('maxQuantityPerCustomer') as string
  const perCustomerNum = maxPerCustomerRaw ? parseInt(maxPerCustomerRaw, 10) : NaN
  const max_quantity_per_customer = Number.isNaN(perCustomerNum) || perCustomerNum < 1 ? null : perCustomerNum
  const deadlineRaw = formData.get('deadline') as string
  const deadline = deadlineRaw ? fromKSTToISOUTC(deadlineRaw) : null

  const inventoryLinkInput = await resolveInventoryLinkInput(supabase, product.shop_id, formData)
  if (inventoryLinkInput.error) {
    return { error: inventoryLinkInput.error }
  }
  const optionsJsonRaw = (formData.get('productOptionsJson') as string) || ''
  const optionsParsed = optionsJsonRaw.trim()
    ? parseProductOptionsJson(optionsJsonRaw)
    : parseProductOptionsRaw((formData.get('productOptionsRaw') as string) || '')
  if (optionsParsed.error) {
    return { error: optionsParsed.error }
  }

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
      option_groups: optionsParsed.groups.length > 0 ? optionsParsed.groups : null,
    })
    .eq('id', productId)

  if (error) return { error: '상품 수정에 실패했습니다' }

  if (inventoryLinkInput.enabled && inventoryLinkInput.inventoryItemId) {
    const { error: upsertLinkError } = await supabase
      .from('product_inventory_links')
      .upsert(
        {
          product_id: productId,
          inventory_item_id: inventoryLinkInput.inventoryItemId,
          consume_per_sale: inventoryLinkInput.consumePerSale,
          is_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'product_id,inventory_item_id' }
      )
    if (upsertLinkError) {
      return { error: '상품 수정은 완료되었지만 재고 연동 저장에 실패했습니다' }
    }

    await supabase
      .from('product_inventory_links')
      .update({ is_enabled: false, updated_at: new Date().toISOString() })
      .eq('product_id', productId)
      .neq('inventory_item_id', inventoryLinkInput.inventoryItemId)
  } else {
    await supabase
      .from('product_inventory_links')
      .update({ is_enabled: false, updated_at: new Date().toISOString() })
      .eq('product_id', productId)
  }

  revalidatePath('/admin/products')
  revalidatePath('/admin/inventory')
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
