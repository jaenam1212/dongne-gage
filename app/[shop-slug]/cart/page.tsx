import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CartPageClient } from '@/components/customer/cart-page-client'
import { OwnerCta } from '@/components/customer/owner-cta'

interface Props {
  params: Promise<{ 'shop-slug': string }>
}

async function getCartPageData(slug: string) {
  const supabase = await createClient()

  const { data: shopWithWeekdays, error: shopWithWeekdaysError } = await supabase
    .from('shops')
    .select('id, slug, name, pickup_available_weekdays')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  const shop =
    shopWithWeekdays ??
    (
      shopWithWeekdaysError
        ? (
            await supabase
              .from('shops')
              .select('id, slug, name')
              .eq('slug', slug)
              .eq('is_active', true)
              .single()
          ).data
        : null
    )

  if (!shop) return null

  const { data: products } = await supabase
    .from('products')
    .select('id, title, price, image_url, max_quantity, max_quantity_per_customer, reserved_count, option_groups, pickup_time_required')
    .eq('shop_id', shop.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return {
    shop,
    products: products ?? [],
  }
}

export default async function CartPage({ params }: Props) {
  const { 'shop-slug': slug } = await params
  const data = await getCartPageData(slug)

  if (!data) notFound()

  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-stone-200 bg-white/80 px-4 backdrop-blur-lg">
        <Link
          href={`/${slug}`}
          className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900 truncate">{data.shop.name}</p>
          <p className="text-xs text-stone-400">장바구니</p>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        <CartPageClient
          shopSlug={slug}
          shopName={data.shop.name}
          products={data.products}
          pickupAvailableWeekdays={data.shop.pickup_available_weekdays ?? null}
        />
      </main>

      <div className="mx-auto max-w-md px-4 pb-6">
        <OwnerCta />
      </div>
    </div>
  )
}
