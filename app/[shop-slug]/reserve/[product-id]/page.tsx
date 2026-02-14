import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ReservationForm } from '@/components/customer/reservation-form'
import { OwnerCta } from '@/components/customer/owner-cta'
import { ArrowLeft, Clock } from 'lucide-react'
import { formatKoreanWon } from '@/lib/utils'

interface Props {
  params: Promise<{ 'shop-slug': string; 'product-id': string }>
}

async function getProductWithShop(slug: string, productId: string) {
  const supabase = await createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('id, slug, name, description, logo_url')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!shop) return null

  const { data: product } = await supabase
    .from('products')
    .select('id, title, description, price, image_url, max_quantity, max_quantity_per_customer, reserved_count, deadline, option_groups, is_active')
    .eq('id', productId)
    .eq('shop_id', shop.id)
    .eq('is_active', true)
    .single()

  if (!product) return null

  const { data: productImages } = await supabase
    .from('product_images')
    .select('image_url, sort_order')
    .eq('product_id', product.id)
    .order('sort_order', { ascending: true })

  const { data: reservedQuantity } = await supabase.rpc('get_product_reserved_quantity', {
    p_product_id: product.id,
  })

  const imageUrls = (productImages ?? []).map((img) => img.image_url)
  if (product.image_url && !imageUrls.includes(product.image_url)) {
    imageUrls.unshift(product.image_url)
  }

  return {
    shop,
    product: {
      ...product,
      reserved_count:
        typeof reservedQuantity === 'number' ? reservedQuantity : product.reserved_count,
      image_urls: imageUrls,
    },
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { 'shop-slug': slug, 'product-id': productId } = await params
  const data = await getProductWithShop(slug, productId)

  if (!data) {
    return { title: '페이지를 찾을 수 없습니다' }
  }

  const { shop, product } = data
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dongnegage.com'

  return {
    title: `${product.title} - ${shop.name}`,
    description: product.description || `${shop.name}에서 ${product.title} 예약하기`,
    openGraph: {
      title: `${product.title} - ${shop.name}`,
      description: product.description || `${formatKoreanWon(product.price)} · ${shop.name}에서 예약하세요`,
      url: `${baseUrl}/${shop.slug}/reserve/${product.id}`,
      siteName: '동네 가게',
      images: product.image_url
        ? [{ url: product.image_url, width: 1200, height: 630 }]
        : shop.logo_url
        ? [{ url: shop.logo_url, width: 1200, height: 630 }]
        : [],
      type: 'website',
      locale: 'ko_KR',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.title} - ${shop.name}`,
      description: product.description || `${formatKoreanWon(product.price)} · ${shop.name}에서 예약하세요`,
    },
  }
}

function isExpired(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

function isSoldOut(product: { max_quantity: number | null; reserved_count: number }): boolean {
  if (product.max_quantity === null) return false
  return product.reserved_count >= product.max_quantity
}

export default async function ReservePage({ params }: Props) {
  const { 'shop-slug': slug, 'product-id': productId } = await params
  const data = await getProductWithShop(slug, productId)

  if (!data) notFound()

  const { shop, product } = data
  const expired = isExpired(product.deadline)
  const soldOut = isSoldOut(product)

  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-stone-200 bg-white/80 backdrop-blur-lg px-4">
        <Link
          href={`/${slug}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-700 transition-colors min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900 truncate">{shop.name}</p>
          <p className="text-xs text-stone-400 truncate">{product.title}</p>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {expired ? (
          <div className="rounded-2xl border border-stone-200 bg-white py-12 text-center shadow-sm">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
                <Clock className="h-7 w-7 text-stone-400" />
              </div>
            </div>
            <h2 className="mt-4 text-lg font-bold text-stone-900">예약이 마감되었습니다</h2>
            <p className="mt-1 text-sm text-stone-500">이 상품의 예약 기한이 지났습니다</p>
            <Link
              href={`/${slug}`}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
            >
              가게로 돌아가기
            </Link>
          </div>
        ) : soldOut ? (
          <div className="rounded-2xl border border-stone-200 bg-white py-12 text-center shadow-sm">
            <h2 className="text-lg font-bold text-stone-900">매진되었습니다</h2>
            <p className="mt-1 text-sm text-stone-500">이 상품은 예약이 모두 완료되었습니다</p>
            <Link
              href={`/${slug}`}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
            >
              가게로 돌아가기
            </Link>
          </div>
        ) : (
          <ReservationForm
            product={product}
            productImages={product.image_urls ?? []}
            shopSlug={slug}
            shopName={shop.name}
          />
        )}
      </main>
      <div className="mx-auto max-w-md px-4 pb-6">
        <OwnerCta />
      </div>
    </div>
  )
}
