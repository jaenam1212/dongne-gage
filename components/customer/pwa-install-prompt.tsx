'use client'

import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed === 'true') {
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowBanner(false)
      localStorage.setItem('pwa-install-dismissed', 'true')
    }

    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white p-4 shadow-lg md:bottom-4 md:left-4 md:right-auto md:max-w-md md:rounded-2xl md:border">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-stone-900">
          <Download className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-stone-900">
            홈 화면에 추가하기
          </h3>
          <p className="mt-0.5 text-xs text-stone-500 leading-relaxed">
            홈 화면에 추가하면 새 상품 알림을 받을 수 있어요!
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={handleInstall}
              size="sm"
              className="bg-stone-900 text-white hover:bg-stone-800"
            >
              설치하기
            </Button>
            <Button
              onClick={handleDismiss}
              size="sm"
              variant="ghost"
              className="text-stone-500 hover:bg-stone-50 hover:text-stone-700"
            >
              닫기
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
