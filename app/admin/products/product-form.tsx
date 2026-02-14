'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ImagePlus, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import { formatKoreanWon, MAX_PRODUCT_PRICE } from '@/lib/utils'
import { toKSTDateOnly, toKSTTimeOnly, getTodayKST } from '@/lib/datetime-kst'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePickerField } from '@/components/ui/time-picker'

interface Product {
  id: string
  title: string
  description: string | null
  price: number
  image_url: string | null
  max_quantity: number | null
  max_quantity_per_customer?: number | null
  reserved_count: number
  deadline: string | null
  inventory_link_enabled?: boolean
  inventory_item_id?: string | null
  inventory_consume_per_sale?: number | null
  image_urls?: string[]
  option_groups?: { name: string; values: string[]; required?: boolean }[] | null
  pickup_time_required?: boolean
}

interface InventoryOption {
  id: string
  sku: string
  name: string
  current_quantity: number
  is_active: boolean
  option_groups?: { name: string; values: string[]; required?: boolean }[] | null
}

interface ProductFormProps {
  product?: Product
  inventoryOptions: InventoryOption[]
  action: (formData: FormData) => Promise<{ error?: string } | undefined>
  submitLabel: string
}

interface ProductOptionRow {
  key: string
  valueText: string
  required: 'required' | 'optional'
}

export function ProductForm({ product, inventoryOptions, action, submitLabel }: ProductFormProps) {
  const [loading, setLoading] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<string[]>(
    product?.image_urls && product.image_urls.length > 0
      ? product.image_urls
      : product?.image_url
      ? [product.image_url]
      : []
  )
  const [priceDisplay, setPriceDisplay] = useState(product?.price ? formatKoreanWon(product.price) : '')
  const [error, setError] = useState<string | null>(null)
  const [inventoryLinkEnabled, setInventoryLinkEnabled] = useState(!!product?.inventory_link_enabled)
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState(product?.inventory_item_id ?? '')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [pickupTimeRequired, setPickupTimeRequired] = useState(!!product?.pickup_time_required)
  const [optionRows, setOptionRows] = useState<ProductOptionRow[]>(() => {
    const groups = product?.option_groups ?? []
    if (groups.length === 0) {
      return [{ key: '', valueText: '', required: 'required' }]
    }
    return groups.map((group) => ({
      key: group.name ?? '',
      valueText: (group.values ?? []).join(', '),
      required: group.required === false ? 'optional' : 'required',
    }))
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addOptionRow() {
    setOptionRows((prev) => [...prev, { key: '', valueText: '', required: 'required' }])
  }

  function removeOptionRow(index: number) {
    setOptionRows((prev) => prev.filter((_, i) => i !== index))
  }

  function updateOptionRow(
    index: number,
    patch: Partial<ProductOptionRow>
  ) {
    setOptionRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  function applyOptionTemplateFromInventory(inventoryItemId: string) {
    const inventoryItem = inventoryOptions.find((item) => item.id === inventoryItemId)
    const template = inventoryItem?.option_groups ?? []
    if (template.length === 0) return

    setOptionRows(
      template.map((group) => ({
        key: group.name ?? '',
        valueText: (group.values ?? []).join(', '),
        required: group.required === false ? 'optional' : 'required',
      }))
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) {
      const invalidFile = files.find((file) => file.size > 5 * 1024 * 1024)
      if (invalidFile) {
        toast.error('이미지는 5MB 이하만 가능합니다')
        e.target.value = ''
        return
      }

      setSelectedFiles((prev) => {
        const merged = [...prev]
        for (const file of files) {
          const exists = merged.some(
            (f) =>
              f.name === file.name &&
              f.size === file.size &&
              f.lastModified === file.lastModified
          )
          if (!exists) {
            merged.push(file)
          }
        }
        return merged
      })
      const next = files.map((file) => URL.createObjectURL(file))
      setPreviewUrls((prev) => [...prev, ...next])
      e.target.value = ''
    }
  }

  function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw) {
      const num = parseInt(raw, 10)
      if (num > MAX_PRODUCT_PRICE) {
        toast.error('상품 금액은 1,000만원을 초과할 수 없습니다')
        setPriceDisplay(formatKoreanWon(MAX_PRODUCT_PRICE))
        return
      }
      setPriceDisplay(formatKoreanWon(num))
    } else {
      setPriceDisplay('')
    }
  }

  function getPriceRawValue(): string {
    return priceDisplay.replace(/[^0-9]/g, '')
  }

  function getPriceNumber(): number {
    return parseInt(getPriceRawValue(), 10) || 0
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const priceNum = getPriceNumber()
    if (priceNum > MAX_PRODUCT_PRICE) {
      setError('상품 금액은 1,000만원을 초과할 수 없습니다')
      toast.error('상품 금액은 1,000만원을 초과할 수 없습니다')
      setLoading(false)
      return
    }
    formData.set('price', getPriceRawValue())

    const deadlineDate = (formData.get('deadlineDate') as string)?.trim()
    const deadlineTime = (formData.get('deadlineTime') as string)?.trim()
    const deadlineValue = deadlineDate
      ? deadlineTime
        ? `${deadlineDate}T${deadlineTime}`
        : `${deadlineDate}T23:59`
      : ''
    formData.set('deadline', deadlineValue)
    formData.delete('images')
    for (const file of selectedFiles) {
      formData.append('images', file)
    }
    const optionGroups = optionRows
      .map((row) => ({
        name: row.key.trim(),
        values: row.valueText
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        required: row.required === 'required',
      }))
      .filter((row) => row.name.length > 0 && row.values.length > 0)
    formData.set('productOptionsJson', JSON.stringify(optionGroups))

    try {
      const result = await action(formData)
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
      }
    } catch (e: unknown) {
      // redirect()가 던지는 예외는 그대로 전파 (성공 후 페이지 이동)
      if (e && typeof e === 'object' && 'digest' in e && String((e as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) {
        throw e
      }
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
                placeholder="예: 시즌 한정 기획 상품"
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

            <div className="space-y-2">
              <Label className="text-stone-700">
                옵션 설정 <span className="text-stone-400 font-normal">(선택)</span>
              </Label>
              <div className="space-y-3">
                {optionRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 sm:grid-cols-12">
                    <Input
                      value={row.key}
                      onChange={(e) => updateOptionRow(index, { key: e.target.value })}
                      placeholder="옵션명 (예: 사이즈, 컬러, 한우)"
                      className="sm:col-span-4 border-stone-200 bg-white focus-visible:ring-stone-400"
                    />
                    <Input
                      value={row.valueText}
                      onChange={(e) => updateOptionRow(index, { valueText: e.target.value })}
                      placeholder="값 (예: S, M, L / 1kg, 2kg)"
                      className="sm:col-span-5 border-stone-200 bg-white focus-visible:ring-stone-400"
                    />
                    <select
                      value={row.required}
                      onChange={(e) =>
                        updateOptionRow(index, {
                          required: e.target.value as 'required' | 'optional',
                        })
                      }
                      className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-900 sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-stone-400"
                    >
                      <option value="required">필수</option>
                      <option value="optional">선택</option>
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeOptionRow(index)}
                      className="h-10 sm:col-span-1"
                      disabled={optionRows.length === 1}
                    >
                      삭제
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addOptionRow}>
                  옵션 추가
                </Button>
              </div>
              <p className="text-xs text-stone-400">
                키-값 형식으로 여러 개 등록할 수 있습니다. 예: 한우 → 1kg, 2kg / 사이즈 → S, M, L / 컬러 → 노랑, 파랑
              </p>
              <input type="hidden" name="productOptionsJson" />
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

              <div className="space-y-2">
                <Label htmlFor="maxQuantityPerCustomer" className="text-stone-700">
                  1인당 구매 수량
                </Label>
                <Input
                  id="maxQuantityPerCustomer"
                  name="maxQuantityPerCustomer"
                  type="number"
                  min={1}
                  defaultValue={product?.max_quantity_per_customer ?? ''}
                  placeholder="비워두면 제한 없음"
                  className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
                />
                <p className="text-xs text-stone-400">같은 전화번호로 예약 시 1인당 최대 수량</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deadlineDate" className="text-stone-700">
                  예약 마감 날짜
                </Label>
                <DatePicker
                  name="deadlineDate"
                  defaultValue={toKSTDateOnly(product?.deadline ?? null)}
                  min={getTodayKST()}
                  placeholder="날짜 선택"
                  inputClassName="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadlineTime" className="text-stone-700">
                  마감 시간 <span className="text-stone-400 font-normal">(선택)</span>
                </Label>
                <TimePickerField
                  name="deadlineTime"
                  defaultValue={toKSTTimeOnly(product?.deadline ?? null)}
                  placeholder="시간 선택 (선택)"
                  inputClassName="h-10"
                />
              </div>
            </div>
            <p className="text-xs text-stone-400">시간을 비우면 해당일 23:59 마감입니다.</p>

            <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="pickupTimeRequired"
                  checked={pickupTimeRequired}
                  onCheckedChange={(checked) => setPickupTimeRequired(checked === true)}
                />
                <div>
                  <Label htmlFor="pickupTimeRequired" className="text-stone-800 cursor-pointer">
                    구매자 픽업 시간 필수 입력
                  </Label>
                  <p className="text-xs text-stone-500 mt-0.5">
                    끄면 구매자는 픽업 시간을 비워둘 수 있습니다.
                  </p>
                </div>
              </div>
              <input type="hidden" name="pickupTimeRequired" value={pickupTimeRequired ? 'true' : 'false'} />
            </div>

            <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="inventoryLinkEnabled"
                  checked={inventoryLinkEnabled}
                  onCheckedChange={(checked) => setInventoryLinkEnabled(checked === true)}
                />
                <div>
                  <Label htmlFor="inventoryLinkEnabled" className="text-stone-800 cursor-pointer">
                    재고 연동 사용
                  </Label>
                  <p className="text-xs text-stone-500 mt-0.5">
                    사용 시 예약 수량만큼 연결된 재고가 자동 차감/복원됩니다.
                  </p>
                </div>
              </div>

              <input
                type="hidden"
                name="inventoryLinkEnabled"
                value={inventoryLinkEnabled ? 'true' : 'false'}
              />

              {inventoryLinkEnabled && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="inventoryItemId" className="text-stone-700">
                      연동 재고 항목 <span className="text-red-500">*</span>
                    </Label>
                    <select
                      id="inventoryItemId"
                      name="inventoryItemId"
                      required={inventoryLinkEnabled}
                      value={selectedInventoryItemId}
                      onChange={(e) => {
                        const nextId = e.target.value
                        setSelectedInventoryItemId(nextId)
                        if (nextId) {
                          applyOptionTemplateFromInventory(nextId)
                        }
                      }}
                      className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
                    >
                      <option value="">재고 항목 선택</option>
                      {inventoryOptions.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                          disabled={!item.is_active}
                        >
                          {item.name} ({item.sku}) · 현재 {item.current_quantity}
                          {!item.is_active ? ' · 비활성' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inventoryConsumePerSale" className="text-stone-700">
                      판매당 차감 수량
                    </Label>
                    <Input
                      id="inventoryConsumePerSale"
                      name="inventoryConsumePerSale"
                      type="number"
                      min={1}
                      defaultValue={product?.inventory_consume_per_sale ?? 1}
                      placeholder="기본값 1"
                      className="border-stone-200 bg-white focus-visible:ring-stone-400"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-stone-700">상품 이미지</Label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100 transition-colors overflow-hidden"
                >
                  {previewUrls.length === 0 ? (
                    <ImagePlus className="h-6 w-6 text-stone-400" />
                  ) : (
                    <span className="text-xs font-semibold text-stone-600">
                      +{previewUrls.length}
                    </span>
                  )}
                </button>
                <div className="text-xs text-stone-400">
                  <p>클릭하여 이미지를 업로드하세요 (여러 장 가능)</p>
                  <p>JPG, PNG, WEBP (각 최대 5MB)</p>
                </div>
              </div>
              {previewUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {previewUrls.slice(0, 8).map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative aspect-square overflow-hidden rounded-lg bg-stone-100">
                      <Image
                        src={url}
                        alt={`상품 이미지 ${idx + 1}`}
                        fill
                        unoptimized={url.startsWith('blob:')}
                        sizes="96px"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                name="images"
                accept="image/*"
                multiple
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
