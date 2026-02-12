import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const alt = '동네 가게'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ 'shop-slug': string }>
}) {
  const { 'shop-slug': slug } = await params
  const supabase = await createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('name, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  const shopName = shop?.name || '동네 가게'
  const shopDescription = shop?.description || '우리 동네 예약 서비스'

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1c1917 0%, #44403c 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            backgroundColor: 'white',
            marginBottom: '30px',
            fontSize: '36px',
          }}
        >
          🏪
        </div>
        <div
          style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: 'white',
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          {shopName}
        </div>
        <div
          style={{
            fontSize: '24px',
            color: '#a8a29e',
            marginTop: '16px',
            textAlign: 'center',
          }}
        >
          {shopDescription}
        </div>
        <div
          style={{
            fontSize: '16px',
            color: '#78716c',
            marginTop: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          동네 가게 · 예약 서비스
        </div>
      </div>
    ),
    { ...size }
  )
}
