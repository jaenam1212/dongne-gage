'use server'

import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'

type RegisterResult = {
  error?: string
  success?: string
  totalRows?: number
  successRows?: number
  failedRows?: number
}

type ProductOptionGroup = { name: string; values: string[]; required: boolean }

type NormalizedInventoryRow = {
  rowNumber: number
  sku: string
  name: string
  unit: string | null
  currentQuantity: number
  minimumQuantity: number
  isActive: boolean
  optionGroups: ProductOptionGroup[]
  rawData: Record<string, unknown>
}

function normalizeHeader(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[_\-./()[\]]+/g, '')
}

function normalizeCell(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function parseNonNegativeInt(value: unknown, fallback = 0): number {
  const raw = normalizeCell(value).replace(/,/g, '')
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed
}

function parseBool(value: unknown, fallback = true): boolean {
  const raw = normalizeCell(value).toLowerCase()
  if (!raw) return fallback
  if (['true', '1', 'y', 'yes', 'on', '사용', '활성', 'o'].includes(raw)) return true
  if (['false', '0', 'n', 'no', 'off', '미사용', '비활성', 'x'].includes(raw)) return false
  return fallback
}

function parseOptionGroupsRaw(raw: string): ProductOptionGroup[] {
  const text = raw.trim()
  if (!text) return []

  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\|/g, '\n')
    .replace(/;/g, '\n')
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const groups: ProductOptionGroup[] = []
  for (const line of lines) {
    const [left, right] = line.split(':')
    if (!left || !right) continue

    const nameRaw = left.trim()
    const required = !nameRaw.endsWith('(선택)')
    const name = required ? nameRaw : nameRaw.replace(/\(선택\)\s*$/, '').trim()
    const values = right
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

    if (!name || values.length === 0) continue
    groups.push({
      name,
      values: Array.from(new Set(values)),
      required,
    })
  }

  return groups
}

function pickByAliases(
  rowEntries: Array<[string, unknown]>,
  aliases: string[]
): unknown {
  for (const alias of aliases) {
    const found = rowEntries.find(([key]) => key === alias)
    if (found) return found[1]
  }
  return undefined
}

function normalizeRow(
  row: Record<string, unknown>,
  rowNumber: number
): NormalizedInventoryRow {
  const normalizedEntries = Object.entries(row).map(([k, v]) => [normalizeHeader(k), v] as [string, unknown])
  const valuesInOrder = Object.values(row)

  const sku =
    normalizeCell(
      pickByAliases(normalizedEntries, [
        'sku',
        'code',
        'itemcode',
        'productcode',
        '품목코드',
        '코드',
      ])
    ) || normalizeCell(valuesInOrder[0])

  const name =
    normalizeCell(
      pickByAliases(normalizedEntries, [
        'name',
        'itemname',
        'productname',
        '품목명',
        '재고명',
        '상품명',
      ])
    ) || normalizeCell(valuesInOrder[1])

  const unit =
    normalizeCell(
      pickByAliases(normalizedEntries, [
        'unit',
        '단위',
      ])
    ) || normalizeCell(valuesInOrder[2])

  const currentQuantity = parseNonNegativeInt(
    pickByAliases(normalizedEntries, [
      'currentquantity',
      'quantity',
      'qty',
      'stock',
      'onhand',
      '재고',
      '재고수량',
      '현재수량',
      '수량',
    ]) ?? valuesInOrder[3],
    0
  )

  const minimumQuantity = parseNonNegativeInt(
    pickByAliases(normalizedEntries, [
      'minimumquantity',
      'minquantity',
      'minqty',
      'safetystock',
      '최소수량',
      '최소재고',
      '안전재고',
    ]) ?? valuesInOrder[4],
    0
  )

  const isActive = parseBool(
    pickByAliases(normalizedEntries, [
      'isactive',
      'active',
      '활성',
      '활성여부',
      '사용여부',
    ]) ?? valuesInOrder[5],
    true
  )

  const optionRaw = normalizeCell(
    pickByAliases(normalizedEntries, [
      'options',
      'option',
      'optiongroups',
      'optiongroup',
      '옵션',
      '옵션값',
      '옵션그룹',
    ]) ?? valuesInOrder[6]
  )
  const optionGroups = parseOptionGroupsRaw(optionRaw)

  return {
    rowNumber,
    sku,
    name,
    unit: unit || null,
    currentQuantity,
    minimumQuantity,
    isActive,
    optionGroups,
    rawData: row,
  }
}

async function getShopIdOrError() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { supabase, error: '인증이 필요합니다', shopId: null as string | null }

  const { data: shop } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!shop) return { supabase, error: '가게를 찾을 수 없습니다', shopId: null as string | null }
  return { supabase, error: null as string | null, shopId: shop.id }
}

export async function registerInventory(formData: FormData): Promise<RegisterResult> {
  const { supabase, error, shopId } = await getShopIdOrError()
  if (error || !shopId) return { error: error ?? '인증 오류' }

  const excelFile = formData.get('excelFile') as File | null
  const hasExcel = excelFile && excelFile.size > 0

  if (!hasExcel) {
    const sku = normalizeCell(formData.get('sku'))
    const name = normalizeCell(formData.get('name'))
    const unit = normalizeCell(formData.get('unit')) || null
    const currentQuantity = parseNonNegativeInt(formData.get('current_quantity'), 0)
    const minimumQuantity = parseNonNegativeInt(formData.get('minimum_quantity'), 0)
    const isActive = parseBool(formData.get('is_active'), true)
    const optionGroups = parseOptionGroupsRaw(normalizeCell(formData.get('option_groups_raw')))

    if (!sku) return { error: 'SKU를 입력해주세요' }
    if (!name) return { error: '품목명을 입력해주세요' }

    const { error: upsertError } = await supabase
      .from('inventory_items')
      .upsert(
        {
          shop_id: shopId,
          sku,
          name,
          unit,
          current_quantity: currentQuantity,
          minimum_quantity: minimumQuantity,
          is_active: isActive,
          option_groups: optionGroups.length > 0 ? optionGroups : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id,sku' }
      )

    if (upsertError) return { error: '재고 등록에 실패했습니다' }

    revalidatePath('/admin/inventory')
    revalidatePath('/admin/products/new')
    return { success: '재고 1건이 등록되었습니다', totalRows: 1, successRows: 1, failedRows: 0 }
  }

  const ext = excelFile.name.split('.').pop()?.toLowerCase()
  if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
    return { error: '엑셀(.xlsx/.xls) 또는 CSV 파일만 업로드할 수 있습니다' }
  }

  const sourceType = ext === 'csv' ? 'csv' : 'xlsx'
  const bytes = new Uint8Array(await excelFile.arrayBuffer())
  const workbook = XLSX.read(bytes, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return { error: '시트가 비어 있습니다' }

  const sheet = workbook.Sheets[firstSheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })

  if (rawRows.length === 0) return { error: '파일에 데이터가 없습니다' }

  const parsedRows = rawRows.map((row, i) => normalizeRow(row, i + 2))

  const { data: job, error: jobError } = await supabase
    .from('inventory_import_jobs')
    .insert({
      shop_id: shopId,
      source_type: sourceType,
      dry_run: false,
      status: 'processing',
      total_rows: parsedRows.length,
    })
    .select('id')
    .single()

  if (jobError || !job) return { error: '등록 작업 생성에 실패했습니다' }

  let successRows = 0
  let failedRows = 0
  const failedEntries: {
    job_id: string
    row_type: 'inventory_item'
    row_number: number
    raw_data: Record<string, unknown>
    error_message: string
  }[] = []

  for (const row of parsedRows) {
    if (!row.sku) {
      failedRows++
      failedEntries.push({
        job_id: job.id,
        row_type: 'inventory_item',
        row_number: row.rowNumber,
        raw_data: row.rawData,
        error_message: 'SKU를 찾을 수 없습니다',
      })
      continue
    }
    if (!row.name) {
      failedRows++
      failedEntries.push({
        job_id: job.id,
        row_type: 'inventory_item',
        row_number: row.rowNumber,
        raw_data: row.rawData,
        error_message: '품목명을 찾을 수 없습니다',
      })
      continue
    }

    const { error: upsertError } = await supabase
      .from('inventory_items')
      .upsert(
        {
          shop_id: shopId,
          sku: row.sku,
          name: row.name,
          unit: row.unit,
          current_quantity: row.currentQuantity,
          minimum_quantity: row.minimumQuantity,
          is_active: row.isActive,
          option_groups: row.optionGroups.length > 0 ? row.optionGroups : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id,sku' }
      )

    if (upsertError) {
      failedRows++
      failedEntries.push({
        job_id: job.id,
        row_type: 'inventory_item',
        row_number: row.rowNumber,
        raw_data: row.rawData,
        error_message: 'DB 저장 실패',
      })
      continue
    }

    successRows++
  }

  if (failedEntries.length > 0) {
    await supabase.from('inventory_import_rows').insert(failedEntries)
  }

  await supabase
    .from('inventory_import_jobs')
    .update({
      status: failedRows > 0 && successRows === 0 ? 'failed' : 'completed',
      success_rows: successRows,
      failed_rows: failedRows,
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id)

  revalidatePath('/admin/inventory')
  revalidatePath('/admin/products/new')
  return {
    success: `등록 완료: 성공 ${successRows}건, 실패 ${failedRows}건`,
    totalRows: parsedRows.length,
    successRows,
    failedRows,
  }
}
