import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatKoreanWon(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}
