'use server'

import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'

type ImportResult = {
  error?: string
  success?: string
  totalRows?: number
  successRows?: number
  failedRows?: number
}

type InventoryItemRow = {
  rowNumber: number
  sku: string
  name: string
  unit: string | null
  currentQuantity: number
  minimumQuantity: number
  isActive: boolean
}

type ProductMappingRow = {
  rowNumber: number
  productIdentifier: string
  inventorySku: string
  consumePerSale: number
  isEnabled: boolean
}

function normalizeCell(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function parseBool(value: unknown, fallback: boolean): boolean {
  const raw = normalizeCell(value).toLowerCase()
  if (!raw) return fallback
  if (['true', '1', 'y', 'yes', 'on'].includes(raw)) return true
  if (['false', '0', 'n', 'no', 'off'].includes(raw)) return false
  return fallback
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const raw = normalizeCell(value)
  if (!raw) return fallback
  const num = Number.parseInt(raw, 10)
  return Number.isNaN(num) || num <= 0 ? fallback : num
}

function parseNonNegativeInt(value: unknown, fallback: number): number {
  const raw = normalizeCell(value)
  if (!raw) return fallback
  const num = Number.parseInt(raw, 10)
  return Number.isNaN(num) || num < 0 ? fallback : num
}

function readSheetRows(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })
}

function parseInventoryRows(rows: Record<string, unknown>[]): InventoryItemRow[] {
  return rows.map((row, idx) => ({
    rowNumber: idx + 2,
    sku: normalizeCell(row.sku),
    name: normalizeCell(row.name),
    unit: normalizeCell(row.unit) || null,
    currentQuantity: parseNonNegativeInt(row.current_quantity, 0),
    minimumQuantity: parseNonNegativeInt(row.minimum_quantity, 0),
    isActive: parseBool(row.is_active, true),
  }))
}

function parseMappingRows(rows: Record<string, unknown>[]): ProductMappingRow[] {
  return rows.map((row, idx) => ({
    rowNumber: idx + 2,
    productIdentifier: normalizeCell(row.product_id_or_title),
    inventorySku: normalizeCell(row.inventory_sku),
    consumePerSale: parsePositiveInt(row.consume_per_sale, 1),
    isEnabled: parseBool(row.is_enabled, true),
  }))
}

async function parseImportFiles(formData: FormData): Promise<{
  sourceType: 'xlsx' | 'csv'
  inventoryRows: InventoryItemRow[]
  mappingRows: ProductMappingRow[]
}> {
  const workbookFile = formData.get('workbookFile') as File | null
  const inventoryCsvFile = formData.get('inventoryCsvFile') as File | null
  const mappingCsvFile = formData.get('mappingCsvFile') as File | null

  if (workbookFile && workbookFile.size > 0) {
    const ext = workbookFile.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx') {
      throw new Error('엑셀 업로드는 .xlsx 파일만 가능합니다')
    }

    const data = new Uint8Array(await workbookFile.arrayBuffer())
    const workbook = XLSX.read(data, { type: 'array' })
    const inventorySheet = workbook.Sheets.InventoryItems
    const mappingSheet = workbook.Sheets.ProductMappings

    if (!inventorySheet || !mappingSheet) {
      throw new Error('엑셀 파일에 InventoryItems / ProductMappings 시트가 모두 필요합니다')
    }

    return {
      sourceType: 'xlsx',
      inventoryRows: parseInventoryRows(readSheetRows(inventorySheet)),
      mappingRows: parseMappingRows(readSheetRows(mappingSheet)),
    }
  }

  if (inventoryCsvFile && inventoryCsvFile.size > 0 && mappingCsvFile && mappingCsvFile.size > 0) {
    const inventoryData = new Uint8Array(await inventoryCsvFile.arrayBuffer())
    const mappingData = new Uint8Array(await mappingCsvFile.arrayBuffer())

    const inventoryWorkbook = XLSX.read(inventoryData, { type: 'array' })
    const mappingWorkbook = XLSX.read(mappingData, { type: 'array' })
    const inventorySheet = inventoryWorkbook.Sheets[inventoryWorkbook.SheetNames[0]]
    const mappingSheet = mappingWorkbook.Sheets[mappingWorkbook.SheetNames[0]]

    if (!inventorySheet || !mappingSheet) {
      throw new Error('CSV 파일을 읽을 수 없습니다')
    }

    return {
      sourceType: 'csv',
      inventoryRows: parseInventoryRows(readSheetRows(inventorySheet)),
      mappingRows: parseMappingRows(readSheetRows(mappingSheet)),
    }
  }

  throw new Error('업로드 파일을 선택해주세요 (.xlsx 또는 재고/매핑 CSV 2개)')
}

export async function importInventoryWorkbook(formData: FormData): Promise<ImportResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: '인증이 필요합니다' }
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!shop) {
    return { error: '가게를 찾을 수 없습니다' }
  }

  const dryRun = (formData.get('dryRun') as string) === 'true'

  let parsed: Awaited<ReturnType<typeof parseImportFiles>>
  try {
    parsed = await parseImportFiles(formData)
  } catch (error) {
    return { error: error instanceof Error ? error.message : '파일 파싱에 실패했습니다' }
  }

  const totalRows = parsed.inventoryRows.length + parsed.mappingRows.length
  const { data: job, error: jobCreateError } = await supabase
    .from('inventory_import_jobs')
    .insert({
      shop_id: shop.id,
      source_type: parsed.sourceType,
      dry_run: dryRun,
      status: 'processing',
      total_rows: totalRows,
    })
    .select('id')
    .single()

  if (jobCreateError || !job) {
    return { error: '업로드 작업 생성에 실패했습니다' }
  }

  let successRows = 0
  let failedRows = 0
  const rowErrors: {
    job_id: string
    row_type: 'inventory_item' | 'product_mapping'
    row_number: number
    raw_data: Record<string, unknown>
    error_message: string
  }[] = []

  try {
    const incomingSkus = new Set<string>()

    for (const row of parsed.inventoryRows) {
      if (!row.sku) {
        failedRows++
        rowErrors.push({
          job_id: job.id,
          row_type: 'inventory_item',
          row_number: row.rowNumber,
          raw_data: row as unknown as Record<string, unknown>,
          error_message: 'sku가 비어 있습니다',
        })
        continue
      }
      if (!row.name) {
        failedRows++
        rowErrors.push({
          job_id: job.id,
          row_type: 'inventory_item',
          row_number: row.rowNumber,
          raw_data: row as unknown as Record<string, unknown>,
          error_message: 'name이 비어 있습니다',
        })
        continue
      }

      incomingSkus.add(row.sku)

      if (!dryRun) {
        const { error } = await supabase
          .from('inventory_items')
          .upsert(
            {
              shop_id: shop.id,
              sku: row.sku,
              name: row.name,
              unit: row.unit,
              current_quantity: row.currentQuantity,
              minimum_quantity: row.minimumQuantity,
              is_active: row.isActive,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'shop_id,sku' }
          )

        if (error) {
          failedRows++
          rowErrors.push({
            job_id: job.id,
            row_type: 'inventory_item',
            row_number: row.rowNumber,
            raw_data: row as unknown as Record<string, unknown>,
            error_message: '재고 항목 업서트 실패',
          })
          continue
        }
      }

      successRows++
    }

    const { data: products } = await supabase
      .from('products')
      .select('id, title')
      .eq('shop_id', shop.id)

    const productsById = new Map<string, { id: string; title: string }>()
    const productsByTitle = new Map<string, { id: string; title: string }[]>()

    for (const product of products ?? []) {
      productsById.set(product.id, product)
      const key = product.title.trim().toLowerCase()
      const prev = productsByTitle.get(key) ?? []
      prev.push(product)
      productsByTitle.set(key, prev)
    }

    const { data: inventoryItems } = await supabase
      .from('inventory_items')
      .select('id, sku')
      .eq('shop_id', shop.id)

    const inventoryBySku = new Map<string, { id: string; sku: string }>()
    for (const item of inventoryItems ?? []) {
      inventoryBySku.set(item.sku, item)
    }

    for (const row of parsed.mappingRows) {
      if (!row.productIdentifier) {
        failedRows++
        rowErrors.push({
          job_id: job.id,
          row_type: 'product_mapping',
          row_number: row.rowNumber,
          raw_data: row as unknown as Record<string, unknown>,
          error_message: 'product_id_or_title이 비어 있습니다',
        })
        continue
      }

      const productById = productsById.get(row.productIdentifier)
      const productByTitleCandidates = productsByTitle.get(row.productIdentifier.toLowerCase()) ?? []
      const product =
        productById ??
        (productByTitleCandidates.length === 1 ? productByTitleCandidates[0] : null)

      if (!product) {
        const reason = productByTitleCandidates.length > 1 ? '동일한 상품명이 여러 개 존재합니다' : '상품을 찾을 수 없습니다'
        failedRows++
        rowErrors.push({
          job_id: job.id,
          row_type: 'product_mapping',
          row_number: row.rowNumber,
          raw_data: row as unknown as Record<string, unknown>,
          error_message: reason,
        })
        continue
      }

      if (!row.inventorySku) {
        failedRows++
        rowErrors.push({
          job_id: job.id,
          row_type: 'product_mapping',
          row_number: row.rowNumber,
          raw_data: row as unknown as Record<string, unknown>,
          error_message: 'inventory_sku가 비어 있습니다',
        })
        continue
      }

      const inventoryItem = inventoryBySku.get(row.inventorySku)
      const existsInIncoming = incomingSkus.has(row.inventorySku)

      if (!inventoryItem && !(dryRun && existsInIncoming)) {
        failedRows++
        rowErrors.push({
          job_id: job.id,
          row_type: 'product_mapping',
          row_number: row.rowNumber,
          raw_data: row as unknown as Record<string, unknown>,
          error_message: `SKU(${row.inventorySku})에 해당하는 재고 항목이 없습니다`,
        })
        continue
      }

      if (!dryRun) {
        if (!inventoryItem) {
          failedRows++
          rowErrors.push({
            job_id: job.id,
            row_type: 'product_mapping',
            row_number: row.rowNumber,
            raw_data: row as unknown as Record<string, unknown>,
            error_message: `SKU(${row.inventorySku}) 재고 항목 조회 실패`,
          })
          continue
        }

        const { error: upsertError } = await supabase
          .from('product_inventory_links')
          .upsert(
            {
              product_id: product.id,
              inventory_item_id: inventoryItem.id,
              consume_per_sale: row.consumePerSale,
              is_enabled: row.isEnabled,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'product_id,inventory_item_id' }
          )

        if (upsertError) {
          failedRows++
          rowErrors.push({
            job_id: job.id,
            row_type: 'product_mapping',
            row_number: row.rowNumber,
            raw_data: row as unknown as Record<string, unknown>,
            error_message: '상품 연동 업서트 실패',
          })
          continue
        }
      }

      successRows++
    }

    if (rowErrors.length > 0) {
      await supabase.from('inventory_import_rows').insert(rowErrors)
    }

    const status = failedRows > 0 && successRows === 0 ? 'failed' : 'completed'
    await supabase
      .from('inventory_import_jobs')
      .update({
        status,
        success_rows: successRows,
        failed_rows: failedRows,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    revalidatePath('/admin/inventory')
    revalidatePath('/admin/products')

    return {
      success: dryRun
        ? `검증 완료: 성공 ${successRows}건, 실패 ${failedRows}건`
        : `업로드 완료: 성공 ${successRows}건, 실패 ${failedRows}건`,
      totalRows,
      successRows,
      failedRows,
    }
  } catch (error) {
    await supabase
      .from('inventory_import_jobs')
      .update({
        status: 'failed',
        success_rows: successRows,
        failed_rows: failedRows,
        error_message: error instanceof Error ? error.message : '처리 중 오류가 발생했습니다',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    return { error: error instanceof Error ? error.message : '업로드 처리에 실패했습니다' }
  }
}
