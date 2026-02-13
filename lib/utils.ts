import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 상품 금액 상한 (1,000만원) */
export const MAX_PRODUCT_PRICE = 10_000_000

export function formatKoreanWon(amount: number): string {
  return `₩${Number(amount).toLocaleString('ko-KR')}`
}
