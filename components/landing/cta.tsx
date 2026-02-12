import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CTA() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <h2 className="text-2xl font-bold text-stone-900 md:text-3xl">
          지금 바로 시작하세요
        </h2>
        <p className="mt-4 text-base text-stone-600">
          5분이면 충분합니다. 신용카드 필요 없습니다.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-8 bg-stone-900 text-white hover:bg-stone-800 h-12 px-8 text-base font-semibold"
        >
          <Link href="/signup">무료로 시작하기</Link>
        </Button>
      </div>
    </section>
  )
}
