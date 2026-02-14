'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { registerInventory } from './actions'

interface InventoryItem {
  id: string
  sku: string
  name: string
  unit: string | null
  current_quantity: number
  minimum_quantity: number
  is_active: boolean
  updated_at: string
  linked_count: number
  option_groups?: { name: string; values: string[]; required?: boolean }[] | null
  stock_option_name?: string | null
}

type OptionTemplateGroup = {
  name: string
  values: string[]
}

function parseOptionTemplate(raw: string): OptionTemplateGroup[] {
  const text = raw.trim()
  if (!text) return []

  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\|/g, '\n')
    .replace(/;/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const groups: OptionTemplateGroup[] = []
  for (const line of lines) {
    const [left, right] = line.split(':')
    if (!left || !right) continue
    const name = left.replace(/\(선택\)\s*$/, '').trim()
    const values = right
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    if (!name || values.length === 0) continue
    groups.push({ name, values: Array.from(new Set(values)) })
  }
  return groups
}

function parseOptionStocks(raw: string): Map<string, number> {
  const map = new Map<string, number>()
  const text = raw.trim()
  if (!text) return map

  const parts = text.split(',').map((part) => part.trim()).filter(Boolean)
  for (const part of parts) {
    const [left, right] = part.split('=')
    const key = (left ?? '').trim()
    const value = Number.parseInt((right ?? '').trim(), 10)
    if (!key || Number.isNaN(value) || value < 0) continue
    map.set(key, value)
  }
  return map
}

export function InventoryClient({
  items,
}: {
  items: InventoryItem[]
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [optionGroupsRaw, setOptionGroupsRaw] = useState('')
  const [stockOptionName, setStockOptionName] = useState('')
  const [optionStocksRaw, setOptionStocksRaw] = useState('')

  const optionTemplateGroups = parseOptionTemplate(optionGroupsRaw)

  useEffect(() => {
    if (optionTemplateGroups.length === 0) return
    setStockOptionName((prev) => {
      if (prev && optionTemplateGroups.some((group) => group.name === prev)) return prev
      return optionTemplateGroups[0].name
    })
  }, [optionTemplateGroups])

  useEffect(() => {
    if (!stockOptionName) return
    const selectedGroup = optionTemplateGroups.find((group) => group.name === stockOptionName)
    if (!selectedGroup) return

    setOptionStocksRaw((prev) => {
      const existing = parseOptionStocks(prev)
      const next = selectedGroup.values.map((value) => `${value}=${existing.get(value) ?? 0}`)
      return next.join(', ')
    })
  }, [optionTemplateGroups, stockOptionName])

  async function handleRegister(formData: FormData) {
    setSubmitting(true)
    try {
      const result = await registerInventory(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(result.success ?? '등록이 완료되었습니다')
      router.refresh()
    } catch {
      toast.error('등록 처리 중 오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium', duration: 3000 }} />
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-stone-900">재고 관리</h1>
          <p className="text-xs text-stone-500">총 {items.length}개 항목</p>
        </div>

        <form action={handleRegister} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">재고 등록</h2>
            <p className="mt-1 text-xs text-stone-500">
              수기 1건 등록 또는 엑셀/CSV 대량 등록을 선택할 수 있습니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">품목명</Label>
              <Input id="name" name="name" placeholder="예: 대표 재고 항목" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">단위</Label>
              <Input id="unit" name="unit" placeholder="예: kg" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="current_quantity">현재 수량</Label>
              <Input id="current_quantity" name="current_quantity" type="number" min={0} defaultValue={0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minimum_quantity">최소 수량</Label>
              <Input id="minimum_quantity" name="minimum_quantity" type="number" min={0} defaultValue={0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="is_active">활성 여부</Label>
              <select
                id="is_active"
                name="is_active"
                defaultValue="true"
                className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
              >
                <option value="true">활성</option>
                <option value="false">비활성</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="option_groups_raw">옵션 템플릿 (선택)</Label>
            <textarea
              id="option_groups_raw"
              name="option_groups_raw"
              rows={3}
              value={optionGroupsRaw}
              onChange={(e) => setOptionGroupsRaw(e.target.value)}
              placeholder={'한우: 1kg, 2kg\n사이즈: S, M, L\n컬러(선택): 노랑, 파랑'}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
            <p className="text-xs text-stone-500">
              상품 등록 시 재고 항목 선택하면 이 옵션 템플릿을 자동으로 불러옵니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="stock_option_name">재고 차감 기준 옵션명 (선택)</Label>
              {optionTemplateGroups.length > 0 ? (
                <select
                  id="stock_option_name"
                  name="stock_option_name"
                  value={stockOptionName}
                  onChange={(e) => setStockOptionName(e.target.value)}
                  className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
                >
                  {optionTemplateGroups.map((group) => (
                    <option key={group.name} value={group.name}>
                      {group.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="stock_option_name"
                  name="stock_option_name"
                  value={stockOptionName}
                  onChange={(e) => setStockOptionName(e.target.value)}
                  placeholder="예: 컬러"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="option_stocks_raw">옵션별 재고 수량 (선택)</Label>
              <Input
                id="option_stocks_raw"
                name="option_stocks_raw"
                value={optionStocksRaw}
                onChange={(e) => setOptionStocksRaw(e.target.value)}
                placeholder="예: 노랑=10, 파랑=10"
              />
            </div>
          </div>
          <p className="text-xs text-stone-500">
            재고 차감 기준 옵션을 지정하면 주문 시 해당 옵션에서만 차감됩니다. (예: 컬러=파랑 선택 시 파랑 재고만 차감)
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="excelFile">엑셀/CSV 파일 (대량 등록)</Label>
            <Input id="excelFile" name="excelFile" type="file" accept=".xlsx,.xls,.csv" />
            <p className="text-xs text-stone-500">
              파일을 넣으면 대량등록이 우선 적용됩니다.
            </p>
          </div>

          <Button type="submit" disabled={submitting} className="bg-stone-900 hover:bg-stone-800 text-white">
            {submitting ? '등록 중...' : '등록하기'}
          </Button>
        </form>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-stone-900">재고 목록</h2>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-stone-500">등록된 재고 항목이 없습니다. 위 등록 폼에서 추가해 주세요.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs font-semibold text-stone-500">
                    <th className="px-3 py-2">품목명</th>
                    <th className="px-3 py-2">현재 수량</th>
                    <th className="px-3 py-2">최소 수량</th>
                    <th className="px-3 py-2">연동 상품</th>
                    <th className="px-3 py-2">옵션 템플릿</th>
                    <th className="px-3 py-2">옵션 재고 기준</th>
                    <th className="px-3 py-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isLow = item.current_quantity <= item.minimum_quantity
                    return (
                      <tr key={item.id} className="border-b border-stone-100 text-stone-700">
                        <td className="px-3 py-2">
                          {item.name}
                          {item.unit ? <span className="ml-1 text-xs text-stone-400">({item.unit})</span> : null}
                        </td>
                        <td className="px-3 py-2">{item.current_quantity}</td>
                        <td className="px-3 py-2">{item.minimum_quantity}</td>
                        <td className="px-3 py-2">{item.linked_count}</td>
                        <td className="px-3 py-2 text-xs text-stone-500">
                          {item.option_groups && item.option_groups.length > 0
                            ? item.option_groups.map((g) => `${g.name}(${g.values.length})`).join(', ')
                            : '-'}
                        </td>
                        <td className="px-3 py-2 text-xs text-stone-500">
                          {item.stock_option_name || '-'}
                        </td>
                        <td className="px-3 py-2">
                          {!item.is_active ? (
                            <span className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600">비활성</span>
                          ) : isLow ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">재고 부족</span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">정상</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
