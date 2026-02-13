'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'

export function PwaTutorialLink({ shopSlug }: { shopSlug: string }) {
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream)
  }, [])

  if (!isIOS) return null

  return (
    <Link
      href={`/${shopSlug}/install-guide`}
      className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50 hover:text-stone-900"
    >
      <PlusCircle className="h-4 w-4 text-stone-500" />
      홈 화면에 추가하는 방법
    </Link>
  )
}
