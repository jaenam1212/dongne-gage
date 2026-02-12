import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Store } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-stone-200 bg-white">
      <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-white to-stone-50" />
      <div className="relative mx-auto max-w-4xl px-4 py-20 text-center md:py-32">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-900 shadow-lg">
          <Store className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-black text-stone-900 md:text-5xl">
          우리 동네 가게를 위한
          <br />
          예약 서비스
        </h1>
        <p className="mt-4 text-base text-stone-600 md:text-lg">
          카카오톡 오픈채팅 대신, 전문적인 예약 시스템으로
          <br className="hidden md:block" />
          고객 관리를 시작하세요
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            className="bg-stone-900 text-white hover:bg-stone-800 h-12 px-8 text-base font-semibold"
          >
            <Link href="/signup">무료로 시작하기</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
