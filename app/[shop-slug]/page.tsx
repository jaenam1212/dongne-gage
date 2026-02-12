import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProductCard } from '@/components/customer/product-card'
import { Store, Phone } from 'lucide-react'

interface Props {
  params: Promise<{ 'shop-slug': string }>
}

async function getShopWithProducts(slug: string) {
  const supabase = await createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('id, slug, name, description, phone, logo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!shop) return null

  const { data: products } = await supabase
    .from('products')
    .select('id, title, description, price, image_url, max_quantity, reserved_count, deadline, is_active')
    .eq('shop_id', shop.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  return { shop, products: products || [] }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { 'shop-slug': slug } = await params
  const data = await getShopWithProducts(slug)

  if (!data) {
    return { title: '페이지를 찾을 수 없습니다' }
  }

  const { shop } = data
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dongnegage.com'

  return {
    title: `${shop.name} - 동네 가게`,
    description: shop.description || `${shop.name}에서 예약하세요`,
    openGraph: {
      title: shop.name,
      description: shop.description || `${shop.name}에서 예약하세요`,
      url: `${baseUrl}/${shop.slug}`,
      siteName: '동네 가게',
      images: shop.logo_url ? [{ url: shop.logo_url, width: 1200, height: 630 }] : [],
      type: 'website',
      locale: 'ko_KR',
    },
    twitter: {
      card: 'summary_large_image',
      title: shop.name,
      description: shop.description || `${shop.name}에서 예약하세요`,
    },
  }
}

export default async function ShopPage({ params }: Props) {
  const { 'shop-slug': slug } = await params
  const data = await getShopWithProducts(slug)

  if (!data) notFound()

  const { shop, products } = data

  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="relative overflow-hidden border-b border-stone-200 bg-white">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-white to-stone-50" />
        <div className="relative mx-auto max-w-2xl px-4 py-8 md:py-12">
          <div className="flex items-center gap-4">
            {shop.logo_url ? (
              <img
                src={shop.logo_url}
                alt={shop.name}
                className="h-14 w-14 rounded-2xl object-cover shadow-sm border border-stone-200"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 shadow-sm">
                <Store className="h-6 w-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-stone-900 md:text-2xl">{shop.name}</h1>
              {shop.description && (
                <p className="mt-0.5 text-sm text-stone-500">{shop.description}</p>
              )}
            </div>
          </div>
          {shop.phone && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-1.5 text-sm text-stone-600">
              <Phone className="h-3.5 w-3.5" />
              {shop.phone}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 md:py-8">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white py-16 text-center shadow-sm">
            <Store className="mx-auto h-10 w-10 text-stone-300" />
            <p className="mt-3 text-sm text-stone-400">현재 등록된 상품이 없습니다</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                shopSlug={slug}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-stone-100 py-6 text-center text-xs text-stone-400">
        <p>동네 가게 · 우리 동네 예약 서비스</p>
      </footer>
    </div>
  )
}
