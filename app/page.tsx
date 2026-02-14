import type { Metadata } from 'next'
import { Hero } from '@/components/landing/hero'
import { Features } from '@/components/landing/features'
import { CTA } from '@/components/landing/cta'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dongnegage.com'

export const metadata: Metadata = {
  title: '동네 가게 | 우리 동네 예약 서비스',
  description:
    '동네 가게는 매장별 예약 주문 페이지를 빠르게 만들어 고객 예약을 관리할 수 있는 서비스입니다.',
  keywords: [
    '동네 가게',
    '가게 예약',
    '예약 주문',
    '소상공인 예약',
    '매장 예약 서비스',
    '재고 연동 예약',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: '동네 가게 | 우리 동네 예약 서비스',
    description:
      '매장별 예약 페이지를 만들고 상품/재고/예약을 한 번에 관리하세요.',
    url: baseUrl,
    siteName: '동네 가게',
    type: 'website',
    locale: 'ko_KR',
    images: [
      {
        url: `${baseUrl}/icon-512.svg`,
        width: 512,
        height: 512,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '동네 가게 | 우리 동네 예약 서비스',
    description:
      '매장별 예약 페이지를 만들고 상품/재고/예약을 한 번에 관리하세요.',
    images: [`${baseUrl}/icon-512.svg`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
}

export default function LandingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '동네 가게',
    url: baseUrl,
    description: '우리 동네 가게 예약 서비스',
    inLanguage: 'ko-KR',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseUrl}/{shopSlug}`,
      'query-input': 'required name=shopSlug',
    },
  }

  return (
    <div className="min-h-dvh bg-stone-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <Features />
      <CTA />
      <footer className="border-t border-stone-100 py-8 text-center text-xs text-stone-400">
        <p>&copy; 2026 동네 가게. All rights reserved.</p>
      </footer>
    </div>
  )
}
