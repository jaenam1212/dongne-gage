'use client'

import { useState } from 'react'
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
}

export function InventoryClient({
  items,
}: {
  items: InventoryItem[]
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

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
              수기 1건 등록 또는 엑셀/CSV 대량 등록을 선택할 수 있습니다. 엑셀 헤더는 다양한 형식을 자동 인식합니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sku">SKU (수기 등록)</Label>
              <Input id="sku" name="sku" placeholder="예: ING-001" />
            </div>
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
            <Label htmlFor="excelFile">엑셀/CSV 파일 (대량 등록)</Label>
            <Input id="excelFile" name="excelFile" type="file" accept=".xlsx,.xls,.csv" />
            <p className="text-xs text-stone-500">
              파일을 넣으면 대량등록이 우선 적용됩니다. (예: SKU/코드, 품목명/상품명, 현재수량/재고수량 등 유연 인식)
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
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">품목명</th>
                    <th className="px-3 py-2">현재 수량</th>
                    <th className="px-3 py-2">최소 수량</th>
                    <th className="px-3 py-2">연동 상품</th>
                    <th className="px-3 py-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isLow = item.current_quantity <= item.minimum_quantity
                    return (
                      <tr key={item.id} className="border-b border-stone-100 text-stone-700">
                        <td className="px-3 py-2 font-mono text-xs">{item.sku}</td>
                        <td className="px-3 py-2">
                          {item.name}
                          {item.unit ? <span className="ml-1 text-xs text-stone-400">({item.unit})</span> : null}
                        </td>
                        <td className="px-3 py-2">{item.current_quantity}</td>
                        <td className="px-3 py-2">{item.minimum_quantity}</td>
                        <td className="px-3 py-2">{item.linked_count}</td>
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
