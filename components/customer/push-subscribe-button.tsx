'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import toast from 'react-hot-toast'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i)
  return output
}

export function PushSubscribeButton({
  shopId,
  shopSlug,
}: {
  shopId: string
  shopSlug: string
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'subscribed' | 'unsupported' | 'ios-need-pwa'>('idle')
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream)
    setIsStandalone(
      (window as any).matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true
    )
  }, [])

  async function handleSubscribe() {
    if (!VAPID_PUBLIC_KEY) {
      toast.error('알림 설정이 되어 있지 않습니다.')
      return
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      toast.error('이 브라우저에서는 알림을 지원하지 않아요.')
      return
    }

    setStatus('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          toast.error('알림을 허용해 주세요.')
          setStatus('idle')
          return
        }
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      const subJson = sub.toJSON()
      const keys = subJson.keys
      if (!keys?.p256dh || !keys?.auth) throw new Error('구독 정보를 읽을 수 없습니다')

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId,
          endpoint: sub.endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '구독에 실패했습니다')
      }

      setStatus('subscribed')
      toast.success('새 상품 알림을 켰어요!')
    } catch (e: any) {
      setStatus('idle')
      toast.error(e?.message || '알림 구독에 실패했어요.')
    }
  }

  // iOS: 푸시는 홈 화면에 추가한 PWA에서만 동작
  if (isIOS && !isStandalone) {
    return (
      <p className="text-xs text-stone-500">
        <Link href={`/${shopSlug}/install-guide`} className="underline hover:text-stone-700">
          홈 화면에 추가
        </Link>
        한 뒤 알림을 받을 수 있어요.
      </p>
    )
  }

  if (status === 'unsupported') return null
  if (status === 'subscribed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-stone-500">
        <Bell className="h-4 w-4 text-emerald-500" />
        알림 켜짐
      </span>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={status === 'loading'}
      onClick={handleSubscribe}
      className="gap-1.5 border-stone-200 text-stone-700 hover:bg-stone-50"
    >
      {status === 'loading' ? (
        '등록 중...'
      ) : (
        <>
          <BellOff className="h-4 w-4" />
          새 상품 알림 받기
        </>
      )}
    </Button>
  )
}
