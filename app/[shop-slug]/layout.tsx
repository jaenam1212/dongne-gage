import { PwaInstallPrompt } from '@/components/customer/pwa-install-prompt'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      {children}
      <PwaInstallPrompt />
    </>
  )
}
