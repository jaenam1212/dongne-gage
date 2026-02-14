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
  children: React.ReactNode
}

export function AdminShell({ shopName, isSystemOwner = false, children }: AdminShellProps) {
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
