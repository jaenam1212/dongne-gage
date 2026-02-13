/** 로그인 전 로컬스토리지 기반 주문 내역 (내 주문 내역) */

export const MY_ORDERS_STORAGE_KEY = 'dongnegage-my-orders'

export interface StoredOrder {
  id: string
  shop_slug: string
  shop_name: string
  product_title: string
  product_price: number
  quantity: number
  total_price: number
  pickup_date: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  customer_name: string
  created_at: string
}

export function getMyOrders(): StoredOrder[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(MY_ORDERS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveOrderToMyOrders(order: StoredOrder): void {
  const list = getMyOrders()
  if (list.some((o) => o.id === order.id)) return
  const next = [order, ...list]
  try {
    window.localStorage.setItem(MY_ORDERS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // quota or private mode
  }
}

export function updateOrderStatusInMyOrders(
  orderId: string,
  status: StoredOrder['status']
): void {
  const list = getMyOrders()
  const idx = list.findIndex((o) => o.id === orderId)
  if (idx === -1) return
  const next = [...list]
  next[idx] = { ...next[idx], status }
  try {
    window.localStorage.setItem(MY_ORDERS_STORAGE_KEY, JSON.stringify(next))
  } catch {}
}
