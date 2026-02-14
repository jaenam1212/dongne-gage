import Link from 'next/link'

export function OwnerCta() {
  return (
    <div className="mt-6 border-t border-stone-200 pt-4 text-center">
      <p className="text-xs text-stone-500">
        사장님이신가요?{' '}
        <Link href="/" className="font-semibold text-stone-700 underline underline-offset-2 hover:text-stone-900">
          내 가게 만들기
        </Link>
      </p>
    </div>
  )
}
