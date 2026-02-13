import { NextRequest } from 'next/server'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dongnegage.com'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ 'shop-slug': string }> }
) {
  const { 'shop-slug': slug } = await params
  const origin = slug ? `/${slug}` : '/'

  const manifest = {
    name: '동네 가게',
    short_name: '동네가게',
    description: '우리 동네 예약 서비스',
    start_url: origin,
    scope: origin,
    display: 'standalone' as const,
    background_color: '#fafaf9',
    theme_color: '#1c1917',
    orientation: 'portrait' as const,
    lang: 'ko',
    icons: [
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
