import Link from 'next/link'
import { Clock, Package, ShoppingBag } from 'lucide-react'
import { formatKoreanWon } from '@/lib/utils'

interface Product {
  id: string
  title: string
  description: string | null
  price: number
  image_url: string | null
  max_quantity: number | null
  reserved_count: number
  deadline: string | null
  is_active: boolean
}

function isExpired(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

function isSoldOut(product: Product): boolean {
  if (product.max_quantity === null) return false
  return product.reserved_count >= product.max_quantity
}

function getRemainingText(product: Product): string {
  if (product.max_quantity === null) return '무제한'
  const remaining = product.max_quantity - product.reserved_count
  if (remaining <= 0) return '매진'
  return `${remaining}개 남음`
}

function formatDeadline(deadline: string): string {
  const d = new Date(deadline)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes} 마감`
}

export function ProductCard({
  product,
  shopSlug,
}: {
  product: Product
  shopSlug: string
}) {
  const expired = isExpired(product.deadline)
  const soldOut = isSoldOut(product)
  const unavailable = expired || soldOut

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 ${
        unavailable
          ? 'border-stone-200 opacity-70'
          : 'border-stone-200 hover:border-stone-300 hover:shadow-md'
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            className={`h-full w-full object-cover transition-transform duration-500 ${
              unavailable ? '' : 'group-hover:scale-105'
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-12 w-12 text-stone-300" />
          </div>
        )}

        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-red-500 px-5 py-2 text-sm font-bold text-white shadow-lg">
              매진
            </span>
          </div>
        )}
        {expired && !soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-700 px-5 py-2 text-sm font-bold text-white shadow-lg">
              <Clock className="h-4 w-4" />
              마감
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-base font-bold text-stone-900 leading-snug">
          {product.title}
        </h3>
        {product.description && (
          <p className="mt-1 text-sm text-stone-500 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}

        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-lg font-extrabold text-stone-900 tracking-tight">
              {formatKoreanWon(product.price)}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-stone-400">
              <span
                className={
                  soldOut
                    ? 'font-semibold text-red-500'
                    : product.max_quantity !== null &&
                      product.max_quantity - product.reserved_count <= 3
                    ? 'font-semibold text-amber-600'
                    : ''
                }
              >
                {getRemainingText(product)}
              </span>
              {product.deadline && !expired && (
                <>
                  <span className="text-stone-300">·</span>
                  <span>{formatDeadline(product.deadline)}</span>
                </>
              )}
            </div>
          </div>

          {!unavailable && (
            <Link
              href={`/${shopSlug}/reserve/${product.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800 active:bg-stone-950 min-h-[44px]"
            >
              <ShoppingBag className="h-4 w-4" />
              예약하기
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
