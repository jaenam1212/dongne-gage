'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus, Pencil, Package, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatKoreanWon } from '@/lib/utils'
import { toggleProductActive } from './actions'
import toast, { Toaster } from 'react-hot-toast'

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
  created_at: string
}

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'active', label: '활성' },
  { key: 'inactive', label: '비활성' },
] as const

function isExpired(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

function getRemainingQuantity(product: Product): string {
  if (product.max_quantity === null) return '무제한'
  return `${product.max_quantity - product.reserved_count}개 남음`
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return ''
  const d = new Date(deadline)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export function ProductList({
  products,
  currentFilter,
}: {
  products: Product[]
  currentFilter: string
}) {
  const router = useRouter()

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{ className: 'text-sm font-medium', duration: 3000 }}
      />

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-stone-900">상품 관리</h1>
          <Button asChild className="h-9 bg-stone-900 text-white hover:bg-stone-800">
            <Link href="/admin/products/new">
              <Plus className="h-4 w-4 mr-1.5" />
              새 상품 등록
            </Link>
          </Button>
        </div>

        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === 'all' ? '/admin/products' : `/admin/products?filter=${f.key}`}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                currentFilter === f.key
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50 hover:text-stone-700'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white py-16 text-center shadow-sm">
            <Package className="mx-auto h-10 w-10 text-stone-300" />
            <p className="mt-3 text-sm text-stone-400">등록된 상품이 없습니다</p>
            <Button asChild className="mt-4 h-9 bg-stone-900 text-white hover:bg-stone-800">
              <Link href="/admin/products/new">
                <Plus className="h-4 w-4 mr-1.5" />
                첫 상품 등록하기
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onToggle={async (isActive) => {
                  try {
                    await toggleProductActive(product.id, isActive)
                    toast.success(isActive ? '상품이 활성화되었습니다' : '상품이 비활성화되었습니다')
                    router.refresh()
                  } catch {
                    toast.error('상태 변경에 실패했습니다')
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function ProductCard({
  product,
  onToggle,
}: {
  product: Product
  onToggle: (isActive: boolean) => void
}) {
  const [toggling, setToggling] = useState(false)
  const expired = isExpired(product.deadline)

  async function handleToggle() {
    setToggling(true)
    await onToggle(!product.is_active)
    setToggling(false)
  }

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm transition-colors ${
      !product.is_active ? 'border-stone-200 opacity-60' : 'border-stone-200'
    }`}>
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="h-6 w-6 text-stone-300" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-stone-900 truncate">
                {product.title}
              </h3>
              {expired && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 border border-red-100">
                  <Clock className="h-3 w-3" />
                  마감
                </span>
              )}
              {!product.is_active && (
                <span className="shrink-0 rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                  비활성
                </span>
              )}
            </div>
            <p className="mt-0.5 text-base font-bold text-stone-800">
              {formatKoreanWon(product.price)}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-stone-400">
            <span>{getRemainingQuantity(product)}</span>
            {product.deadline && (
              <>
                <span>·</span>
                <span>마감 {formatDeadline(product.deadline)}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            asChild
          >
            <Link href={`/admin/products/${product.id}/edit`}>
              <Pencil className="h-3 w-3 mr-1" />
              수정
            </Link>
          </Button>
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling}
            className="relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 disabled:opacity-50"
            style={{
              backgroundColor: product.is_active ? '#1c1917' : '#d6d3d1',
            }}
            aria-label={product.is_active ? '비활성화' : '활성화'}
          >
            <span
              className="block h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
              style={{
                transform: product.is_active ? 'translateX(22px)' : 'translateX(2px)',
              }}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
