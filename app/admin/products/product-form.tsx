'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImagePlus, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
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
}

interface ProductFormProps {
  product?: Product
  action: (formData: FormData) => Promise<{ error?: string } | undefined>
  submitLabel: string
}

export function ProductForm({ product, action, submitLabel }: ProductFormProps) {
  const [loading, setLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(product?.image_url ?? null)
  const [priceDisplay, setPriceDisplay] = useState(product?.price ? formatKoreanWon(product.price) : '')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('이미지는 5MB 이하만 가능합니다')
        e.target.value = ''
        return
      }
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw) {
      setPriceDisplay(formatKoreanWon(parseInt(raw)))
    } else {
      setPriceDisplay('')
    }
  }

  function getPriceRawValue(): string {
    return priceDisplay.replace(/[^0-9]/g, '')
  }

  function formatDeadlineForInput(deadline: string | null): string {
    if (!deadline) return ''
    const d = new Date(deadline)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    formData.set('price', getPriceRawValue())

    try {
      const result = await action(formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      }
    } catch {
      toast.error('처리 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{ className: 'text-sm font-medium', duration: 3000 }}
      />

      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold text-stone-900">
            {product ? '상품 수정' : '새 상품 등록'}
          </h1>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-stone-700">
                상품명 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                defaultValue={product?.title ?? ''}
                required
                placeholder="예: 설 명절 한우 세트"
                className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-stone-700">
                설명
              </Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={product?.description ?? ''}
                placeholder="상품에 대한 설명을 입력하세요"
                rows={3}
                className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priceDisplay" className="text-stone-700">
                  가격 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="priceDisplay"
                  value={priceDisplay}
                  onChange={handlePriceChange}
                  placeholder="₩0"
                  inputMode="numeric"
                  className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
                />
                <input type="hidden" name="price" value={getPriceRawValue()} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxQuantity" className="text-stone-700">
                  최대 수량
                </Label>
                <Input
                  id="maxQuantity"
                  name="maxQuantity"
                  type="number"
                  min={product?.reserved_count ?? 0}
                  defaultValue={product?.max_quantity ?? ''}
                  placeholder="비워두면 무제한"
                  className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
                />
                {product && product.reserved_count > 0 && (
                  <p className="text-xs text-amber-600">
                    현재 {product.reserved_count}건 예약됨 — 이 이하로 줄일 수 없습니다
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline" className="text-stone-700">
                예약 마감일
              </Label>
              <Input
                id="deadline"
                name="deadline"
                type="datetime-local"
                defaultValue={formatDeadlineForInput(product?.deadline ?? null)}
                className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-stone-700">상품 이미지</Label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100 transition-colors overflow-hidden"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="상품 이미지 미리보기"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-stone-400" />
                  )}
                </button>
                <div className="text-xs text-stone-400">
                  <p>클릭하여 이미지를 업로드하세요</p>
                  <p>JPG, PNG (최대 5MB)</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                name="image"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={loading}
              className="h-11 bg-stone-900 text-white hover:bg-stone-800 transition-colors px-8"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                submitLabel
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              asChild
            >
              <Link href="/admin/products">취소</Link>
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
