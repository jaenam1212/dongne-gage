import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  const workbook = XLSX.utils.book_new()

  const inventoryRows = [
    {
      sku: 'ING-001',
      name: '한우 원재료',
      unit: 'kg',
      current_quantity: 120,
      minimum_quantity: 20,
      is_active: true,
    },
  ]

  const mappingRows = [
    {
      product_id_or_title: '상품 ID 또는 정확한 상품명',
      inventory_sku: 'ING-001',
      consume_per_sale: 1,
      is_enabled: true,
    },
  ]

  const inventorySheet = XLSX.utils.json_to_sheet(inventoryRows)
  const mappingSheet = XLSX.utils.json_to_sheet(mappingRows)
  XLSX.utils.book_append_sheet(workbook, inventorySheet, 'InventoryItems')
  XLSX.utils.book_append_sheet(workbook, mappingSheet, 'ProductMappings')

  const fileBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="inventory-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
