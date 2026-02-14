import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dongnegage.com'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ 'shop-slug': string }> }
) {
  const { 'shop-slug': slug } = await params
  const origin = slug ? `/${slug}` : '/'
  const supabase = await createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('name, logo_url, updated_at')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  const shopName = shop?.name?.trim() || '동네 가게'
  const logoVersion = shop?.updated_at ? Date.parse(shop.updated_at) : Date.now()
  const logoUrl = shop?.logo_url
    ? `${shop.logo_url}${shop.logo_url.includes('?') ? '&' : '?'}v=${logoVersion}`
    : null

  const manifest = {
    name: `${shopName} - 동네 가게`,
    short_name: shopName.length > 12 ? shopName.slice(0, 12) : shopName,
    description: `${shopName} 예약 서비스`,
    start_url: origin,
    scope: origin,
    display: 'standalone' as const,
    background_color: '#fafaf9',
    theme_color: '#1c1917',
    orientation: 'portrait' as const,
    lang: 'ko',
    icons: logoUrl
      ? [
          { src: logoUrl, purpose: 'any' as const },
          { src: `${baseUrl}/icon-192.svg`, sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' as const },
          { src: `${baseUrl}/icon-512.svg`, sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' as const },
        ]
      : [
          { src: `${baseUrl}/icon-192.svg`, sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' as const },
          { src: `${baseUrl}/icon-512.svg`, sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' as const },
        ],
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
