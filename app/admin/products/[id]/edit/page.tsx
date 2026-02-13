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
      }}
      action={boundAction}
      submitLabel="저장"
    />
  )
}
