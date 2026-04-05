'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { getCartCount, subscribeCartUpdates } from '@/lib/cart-storage'

export function CartButton({ shopSlug }: { shopSlug: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const sync = () => setCount(getCartCount(shopSlug))
    sync()
    return subscribeCartUpdates(shopSlug, sync)
  }, [shopSlug])

  return (
    <Link
      href={`/${shopSlug}/cart`}
      className="relative inline-flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-800 transition-colors"
    >
      <ShoppingCart className="h-3.5 w-3.5" />
      장바구니
      {count > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-stone-900 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  )
}
