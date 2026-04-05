const CART_STORAGE_PREFIX = 'dongnegage-cart'
const CART_UPDATED_EVENT = 'dongnegage-cart-updated'

export interface CartItem {
  id: string
  product_id: string
  title: string
  price: number
  image_url: string | null
  quantity: number
  selected_options: Record<string, string>
  added_at: string
}

function getCartStorageKey(shopSlug: string): string {
  return `${CART_STORAGE_PREFIX}:${shopSlug}`
}

function normalizeOptions(selectedOptions: Record<string, string> | null | undefined): Record<string, string> {
  return Object.entries(selectedOptions ?? {})
    .filter((entry): entry is [string, string] => {
      const [key, value] = entry
      return typeof key === 'string' && key.trim().length > 0 && typeof value === 'string' && value.trim().length > 0
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})
}

function createCartItemId(productId: string, selectedOptions: Record<string, string>): string {
  return `${productId}:${JSON.stringify(selectedOptions)}`
}

function emitCartUpdated(shopSlug: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(CART_UPDATED_EVENT, {
      detail: { shopSlug },
    })
  )
}

export function getCartItems(shopSlug: string): CartItem[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(getCartStorageKey(shopSlug))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as CartItem[]) : []
  } catch {
    return []
  }
}

function saveCartItems(shopSlug: string, items: CartItem[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getCartStorageKey(shopSlug), JSON.stringify(items))
  emitCartUpdated(shopSlug)
}

export function addCartItem(
  shopSlug: string,
  item: Omit<CartItem, 'id' | 'added_at'>
): CartItem[] {
  const selectedOptions = normalizeOptions(item.selected_options)
  const id = createCartItemId(item.product_id, selectedOptions)
  const list = getCartItems(shopSlug)
  const existingIndex = list.findIndex((cartItem) => cartItem.id === id)

  const nextItem: CartItem = {
    ...item,
    id,
    selected_options: selectedOptions,
    added_at: new Date().toISOString(),
  }

  const next =
    existingIndex === -1
      ? [nextItem, ...list]
      : list.map((cartItem, index) =>
          index === existingIndex
            ? {
                ...cartItem,
                quantity: cartItem.quantity + item.quantity,
                title: item.title,
                price: item.price,
                image_url: item.image_url,
                selected_options: selectedOptions,
              }
            : cartItem
        )

  saveCartItems(shopSlug, next)
  return next
}

export function updateCartItemQuantity(
  shopSlug: string,
  itemId: string,
  quantity: number
): CartItem[] {
  const next = getCartItems(shopSlug)
    .map((item) => (item.id === itemId ? { ...item, quantity } : item))
    .filter((item) => item.quantity > 0)

  saveCartItems(shopSlug, next)
  return next
}

export function removeCartItem(shopSlug: string, itemId: string): CartItem[] {
  const next = getCartItems(shopSlug).filter((item) => item.id !== itemId)
  saveCartItems(shopSlug, next)
  return next
}

export function replaceCartItems(shopSlug: string, items: CartItem[]) {
  saveCartItems(shopSlug, items)
}

export function clearCart(shopSlug: string) {
  saveCartItems(shopSlug, [])
}

export function getCartCount(shopSlug: string): number {
  return getCartItems(shopSlug).reduce((sum, item) => sum + item.quantity, 0)
}

export function subscribeCartUpdates(
  shopSlug: string,
  callback: () => void
): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleStorage = (event: StorageEvent) => {
    if (event.key === getCartStorageKey(shopSlug)) {
      callback()
    }
  }

  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ shopSlug?: string }>).detail
    if (!detail?.shopSlug || detail.shopSlug === shopSlug) {
      callback()
    }
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(CART_UPDATED_EVENT, handleCustom)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(CART_UPDATED_EVENT, handleCustom)
  }
}
