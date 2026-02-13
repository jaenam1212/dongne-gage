import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '내 주문 내역 - 동네 가게',
  description: '예약한 주문 내역을 확인할 수 있습니다.',
}

export default function MyOrdersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
