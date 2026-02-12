import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-stone-50 px-4">
      <div className="text-center">
        <p className="text-7xl font-black text-stone-200">404</p>
        <h1 className="mt-4 text-xl font-bold text-stone-900">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          요청하신 페이지가 존재하지 않거나 이동되었습니다
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
