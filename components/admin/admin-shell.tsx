'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  CalendarCheck,
  Boxes,
  Settings,
  BarChart3,
  LogOut,
  Store,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/admin/login/actions'
import type { ShopBillingSnapshot } from '@/lib/billing'

const BASE_NAV_ITEMS = [
  { href: '/admin/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin/products', label: '상품 관리', icon: Package },
  { href: '/admin/reservations', label: '예약 관리', icon: CalendarCheck },
  { href: '/admin/inventory', label: '재고 관리', icon: Boxes },
  { href: '/admin/settings', label: '설정', icon: Settings },
]

interface AdminShellProps {
  shopName: string
  logoUrl?: string | null
  isSystemOwner?: boolean
  billing?: ShopBillingSnapshot | null
  children: React.ReactNode
}

export function AdminShell({ shopName, isSystemOwner = false, billing, children }: AdminShellProps) {
  const pathname = usePathname()
  const navItems = isSystemOwner
    ? [...BASE_NAV_ITEMS, { href: '/admin/system-dashboard', label: '시스템 대시보드', icon: BarChart3 }]
    : BASE_NAV_ITEMS

  return (
    <div className="min-h-dvh bg-stone-50">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-stone-200 bg-white md:flex md:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-stone-200 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-xs font-bold text-white">
            동
          </div>
          <span className="text-sm font-semibold text-stone-900 truncate">
            {shopName}
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-stone-200 p-3">
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start gap-3 text-stone-500 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              로그아웃
            </Button>
          </form>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-stone-200 bg-white/80 backdrop-blur-lg px-4 md:hidden">
        <div className="flex items-center gap-2.5">
          <Store className="h-5 w-5 text-stone-700" />
          <span className="text-sm font-semibold text-stone-900 truncate max-w-[200px]">
            {shopName}
          </span>
        </div>
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-stone-500 hover:text-red-600 h-8 px-2"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </header>

      {/* Desktop Header */}
      <header className="sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-stone-200 bg-white/80 backdrop-blur-lg px-6 md:ml-60 md:flex">
        <h2 className="text-sm font-medium text-stone-700">
          {navItems.find((item) => pathname.startsWith(item.href))?.label ?? '관리자'}
        </h2>
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Store className="h-3.5 w-3.5" />
          {shopName}
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20 md:pb-6 md:ml-60">
        <div className="mx-auto max-w-4xl px-4 py-5 md:px-6 md:py-6">
          {billing?.readOnlyMode && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-700">무료체험이 종료되었습니다</p>
              <p className="mt-1 text-xs text-red-600">현재 읽기 전용 모드입니다. 결제를 완료하면 즉시 편집 기능이 복구됩니다.</p>
              <Link href="/admin/billing" className="mt-2 inline-block text-xs font-semibold text-red-700 underline underline-offset-2">
                결제하러 가기
              </Link>
            </div>
          )}
          {!billing?.readOnlyMode && billing?.shouldShowReminder && billing.reminderDay && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-800">
                무료 사용 기한이 {billing.reminderDay}일 남았습니다
              </p>
              <p className="mt-1 text-xs text-amber-700">
                미리 결제해도 무료체험은 종료일까지 유지되며, 종료 후 자동으로 유료가 시작됩니다.
              </p>
              <Link href="/admin/billing" className="mt-2 inline-block text-xs font-semibold text-amber-800 underline underline-offset-2">
                결제 설정하기
              </Link>
            </div>
          )}
          {billing?.paidScheduledAfterTrial && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-700">
                결제가 완료되었습니다. 무료체험 종료 후 유료가 시작됩니다.
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                무료체험 기간은 그대로 유지되며 종료일까지 계속 이용할 수 있습니다.
              </p>
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur-lg md:hidden">
        <div className="flex items-center justify-around py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-stone-900' : 'text-stone-400'
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
