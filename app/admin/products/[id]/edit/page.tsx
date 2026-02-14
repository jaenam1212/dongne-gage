import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ProductForm } from '../../product-form'
import { updateProduct } from '../../actions'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return notFound()

  const { data: product } = await supabase
    .from('products')
    .select('*, shops!inner(owner_id)')
    .eq('id', id)
    .single()

  if (!product || (product.shops as { owner_id: string }).owner_id !== user.id) {
    return notFound()
  }

  const { data: inventoryItems } = await supabase
    .from('inventory_items')
    .select('id, sku, name, current_quantity, is_active')
    .eq('shop_id', product.shop_id)
    .order('name', { ascending: true })

  const { data: activeLinks } = await supabase
    .from('product_inventory_links')
    .select('inventory_item_id, consume_per_sale, is_enabled')
    .eq('product_id', product.id)
    .eq('is_enabled', true)
    .order('updated_at', { ascending: false })
    .limit(1)

  const activeLink = activeLinks?.[0]
  const { data: productImages } = await supabase
    .from('product_images')
    .select('image_url, sort_order')
    .eq('product_id', product.id)
    .order('sort_order', { ascending: true })

  const mergedImageUrls = (() => {
    const list = (productImages ?? []).map((img) => img.image_url)
    if (product.image_url && !list.includes(product.image_url)) {
      list.unshift(product.image_url)
    }
    return list
  })()

  const boundAction = updateProduct.bind(null, id)

  return (
    <ProductForm
      product={{
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        image_url: product.image_url,
        max_quantity: product.max_quantity,
        max_quantity_per_customer: product.max_quantity_per_customer ?? undefined,
        reserved_count: product.reserved_count,
        deadline: product.deadline,
        inventory_link_enabled: !!activeLink,
        inventory_item_id: activeLink?.inventory_item_id ?? null,
        inventory_consume_per_sale: activeLink?.consume_per_sale ?? 1,
        image_urls: mergedImageUrls,
      }}
      inventoryOptions={inventoryItems ?? []}
      action={boundAction}
      submitLabel="저장"
    />
  )
}
