'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Upload, FileSpreadsheet, AlertTriangle, History } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { importInventoryWorkbook } from './actions'

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

interface ImportJob {
  id: string
  source_type: 'xlsx' | 'csv'
  dry_run: boolean
  status: 'processing' | 'completed' | 'failed'
  total_rows: number
  success_rows: number
  failed_rows: number
  error_message: string | null
  created_at: string
}

export function InventoryClient({
  items,
  jobs,
}: {
  items: InventoryItem[]
  jobs: ImportJob[]
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [dryRun, setDryRun] = useState(true)

  async function handleUpload(formData: FormData) {
    setSubmitting(true)
    formData.set('dryRun', dryRun ? 'true' : 'false')

    try {
      const result = await importInventoryWorkbook(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(result?.success ?? '업로드가 완료되었습니다')
      router.refresh()
    } catch {
      toast.error('업로드 중 오류가 발생했습니다')
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
          <Link
            href="/admin/inventory/template"
            className="inline-flex h-9 items-center rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 hover:bg-stone-50"
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            템플릿 다운로드
          </Link>
        </div>

        <form action={handleUpload} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <p className="text-sm font-semibold text-stone-900">엑셀/CSV 업로드</p>
            <p className="text-xs text-stone-500 mt-1">
              xlsx는 InventoryItems + ProductMappings 2개 시트가 필요합니다. CSV는 재고/매핑 2개 파일을 각각 업로드하세요.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs text-stone-600">엑셀 파일 (.xlsx)</label>
              <Input name="workbookFile" type="file" accept=".xlsx" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-600">재고 CSV (InventoryItems)</label>
              <Input name="inventoryCsvFile" type="file" accept=".csv" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-stone-600">매핑 CSV (ProductMappings)</label>
            <Input name="mappingCsvFile" type="file" accept=".csv" />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="dry-run"
              checked={dryRun}
              onCheckedChange={(v) => setDryRun(v === true)}
            />
            <label htmlFor="dry-run" className="text-sm text-stone-700 cursor-pointer">
              Dry-run (적용 없이 검증만 수행)
            </label>
          </div>

          <Button type="submit" disabled={submitting} className="bg-stone-900 hover:bg-stone-800 text-white">
            <Upload className="mr-1.5 h-4 w-4" />
            {submitting ? '업로드 처리 중...' : '업로드 실행'}
          </Button>
        </form>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-stone-900">재고 목록</h2>
          </div>
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-stone-500">등록된 재고 항목이 없습니다.</p>
            ) : (
              items.map((item) => {
                const isLow = item.current_quantity <= item.minimum_quantity
                return (
                  <div key={item.id} className="rounded-xl border border-stone-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-stone-900">
                          {item.name}
                          <span className="ml-2 text-xs font-normal text-stone-500">({item.sku})</span>
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          현재 {item.current_quantity}
                          {item.unit ? ` ${item.unit}` : ''} / 최소 {item.minimum_quantity}
                          {item.unit ? ` ${item.unit}` : ''} · 연동 상품 {item.linked_count}개
                        </p>
                      </div>
                      <div className="text-xs">
                        {!item.is_active && (
                          <span className="rounded-full bg-stone-100 px-2 py-1 text-stone-600">비활성</span>
                        )}
                        {isLow && item.is_active && (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">재고 부족</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-stone-600" />
            <h2 className="text-sm font-semibold text-stone-900">최근 업로드 이력</h2>
          </div>
          {jobs.length === 0 ? (
            <p className="text-sm text-stone-500">업로드 이력이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-stone-200 px-4 py-3 text-xs">
                  <p className="text-stone-700">
                    {new Date(job.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · {job.source_type.toUpperCase()}
                    {job.dry_run ? ' · DRY-RUN' : ''}
                  </p>
                  <p className="mt-1 text-stone-600">
                    상태: {job.status} / 성공 {job.success_rows} / 실패 {job.failed_rows} / 총 {job.total_rows}
                  </p>
                  {job.error_message && <p className="mt-1 text-red-600">{job.error_message}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
