import { createClient } from '@/lib/supabase/server'
import { ProductList } from './product-list'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: shop } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!shop) return null

  let query = supabase
    .from('products')
    .select('*')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })

  if (filter === 'active') {
    query = query.eq('is_active', true)
  } else if (filter === 'inactive') {
    query = query.eq('is_active', false)
  }

  const { data: products } = await query

  return <ProductList products={products ?? []} currentFilter={filter ?? 'all'} />
}
