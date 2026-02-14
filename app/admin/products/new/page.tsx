import { ProductForm } from '../product-form'
import { createProduct } from '../actions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NewProductPage() {
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

  const { data: inventoryItems } = await supabase
    .from('inventory_items')
    .select('id, sku, name, current_quantity, is_active')
    .eq('shop_id', shop.id)
    .order('name', { ascending: true })

  return (
    <ProductForm
      inventoryOptions={inventoryItems ?? []}
      action={createProduct}
      submitLabel="등록"
    />
  )
}
