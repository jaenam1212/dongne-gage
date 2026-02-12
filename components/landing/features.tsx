import { Calendar, Bell, Smartphone } from 'lucide-react'

const FEATURES = [
  {
    icon: Calendar,
    title: '간편한 예약 관리',
    description: '상품 등록부터 예약 확인까지 한 곳에서',
  },
  {
    icon: Bell,
    title: '실시간 알림',
    description: '새 예약이 들어오면 즉시 푸시 알림',
  },
  {
    icon: Smartphone,
    title: '모바일 최적화',
    description: '스마트폰으로 언제 어디서나 관리',
  },
]

export function Features() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-4">
        <h2 className="text-center text-2xl font-bold text-stone-900 md:text-3xl">
          이런 기능을 제공합니다
        </h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900">
                <feature.icon className="h-7 w-7 text-white" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-stone-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-stone-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
