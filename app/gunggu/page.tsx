import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, PackageCheck, Smartphone, BarChart3 } from 'lucide-react'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dongnegage.com'

export const metadata: Metadata = {
  title: '인스타 공구용 주문 페이지 | 동네 가게',
  description:
    '인스타 공동구매 판매자를 위한 주문/옵션/재고 관리 랜딩입니다. 구글폼 대신 주문을 자동 수집하고 관리하세요.',
  alternates: { canonical: '/gunggu' },
  openGraph: {
    title: '인스타 공구용 주문 페이지 | 동네 가게',
    description:
      '구글폼 대신 공구 주문을 자동 수집하고 옵션별 재고까지 관리하세요.',
    url: `${baseUrl}/gunggu`,
    siteName: '동네 가게',
    type: 'website',
    locale: 'ko_KR',
  },
}

const FEATURES = [
  {
    icon: PackageCheck,
    title: '옵션별 재고 자동 차감',
    description: '컬러/사이즈별 재고를 정확히 분리해 관리합니다.',
  },
  {
    icon: Smartphone,
    title: '링크 하나로 주문 수집',
    description: '인스타 프로필/스토리에 링크만 붙이면 주문이 바로 들어옵니다.',
  },
  {
    icon: BarChart3,
    title: '판매 로그와 예약 전환 확인',
    description: '방문/주문 데이터를 대시보드에서 바로 확인할 수 있습니다.',
  },
]

export default function GroupBuyLandingPage() {
  return (
    <div className="min-h-dvh bg-stone-50">
      <section className="relative overflow-hidden border-b border-stone-200 bg-white">
        <div className="absolute inset-0 bg-linear-to-br from-amber-50 via-white to-stone-100" />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center md:py-24">
          <p className="text-xs font-semibold tracking-wide text-stone-500">INSTAGRAM GROUP BUY</p>
          <h1 className="mt-3 text-3xl font-black text-stone-900 md:text-5xl">
            인스타 공구 판매자를 위한
            <br />
            주문/재고 관리 페이지
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-stone-600 md:text-base">
            아직도 구글폼으로 주문 받는다면, 이제 링크 하나로 옵션/재고/주문 상태까지 한 번에 관리하세요.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="h-12 bg-stone-900 px-8 text-base font-semibold text-white hover:bg-stone-800">
              <Link href="/signup">무료로 시작하기</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base font-semibold">
              <Link href="/">메인 페이지 보기</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <feature.icon className="h-6 w-6 text-stone-800" />
              <h2 className="mt-3 text-base font-bold text-stone-900">{feature.title}</h2>
              <p className="mt-1 text-sm text-stone-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900">이런 분께 특히 추천합니다</h3>
          <div className="mt-4 space-y-2">
            {[
              '스토리/DM로 주문이 섞여 정리가 어려운 판매자',
              '색상/사이즈별 재고가 매번 헷갈리는 공구 운영자',
              '주문 상태를 한눈에 보고 싶고 반복 응대를 줄이고 싶은 분',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p className="text-sm text-stone-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
