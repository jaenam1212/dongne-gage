import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InventoryClient } from './inventory-client'

export default async function InventoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!shop) {
    redirect('/admin/login')
  }

  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, sku, name, unit, current_quantity, minimum_quantity, is_active, option_groups, stock_option_name, updated_at')
    .eq('shop_id', shop.id)
    .order('updated_at', { ascending: false })

  const { data: links } = await supabase
    .from('product_inventory_links')
    .select('inventory_item_id, is_enabled, products!inner(shop_id)')
    .eq('products.shop_id', shop.id)

  const linkedCountMap = new Map<string, number>()
  for (const link of links ?? []) {
    if (!link.is_enabled) continue
    linkedCountMap.set(
      link.inventory_item_id,
      (linkedCountMap.get(link.inventory_item_id) ?? 0) + 1
    )
  }

  const normalizedItems = (items ?? []).map((item) => ({
    ...item,
    linked_count: linkedCountMap.get(item.id) ?? 0,
  }))

  return <InventoryClient items={normalizedItems} />
}
