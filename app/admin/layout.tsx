import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { AdminShell } from '@/components/admin/admin-shell'
import { getShopBillingSnapshot } from '@/lib/billing'

export const metadata: Metadata = {
  title: '관리자 - 동네 가게',
  description: '가게 관리자 페이지',
}

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <>{children}</>
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('name, logo_url, is_system_owner')
    .eq('owner_id', user.id)
    .single()

  const billing = await getShopBillingSnapshot(supabase, user.id)

  return (
    <AdminShell
      shopName={shop?.name ?? '내 가게'}
      logoUrl={shop?.logo_url}
      isSystemOwner={shop?.is_system_owner ?? false}
      billing={billing}
    >
      {children}
    </AdminShell>
  )
}
