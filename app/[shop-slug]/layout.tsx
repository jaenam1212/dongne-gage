import type { Metadata } from 'next'
import { PwaInstallPrompt } from '@/components/customer/pwa-install-prompt'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

type Props = { children: React.ReactNode; params: Promise<{ 'shop-slug': string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { 'shop-slug': slug } = await params
  return {
    manifest: `/${slug}/manifest`,
  }
}

export default function ShopLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <PwaInstallPrompt />
    </>
  )
}
