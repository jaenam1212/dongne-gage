'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, Plus, Home, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

export default function InstallGuidePage() {
  const router = useRouter()
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isSafari, setIsSafari] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const iosCheck = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    const safariCheck = /^((?!chrome|android).)*safari/i.test(ua)
    
    setIsIOS(iosCheck)
    setIsSafari(safariCheck)

    if (!iosCheck || !safariCheck) {
      router.back()
    }
  }, [router])

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('ios-install-guide-dismissed', 'true')
    }
    router.back()
  }

  if (!isIOS || !isSafari) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm md:items-center md:justify-center">
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl md:rounded-3xl">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          aria-label="닫기"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-900">
            <Home className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">
            홈 화면에 추가하기
          </h1>
          <p className="mt-2 text-sm text-stone-500 leading-relaxed">
            앱처럼 빠르게 접속하고 새 상품 알림을 받아보세요!
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-900">
              1
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-blue-500" />
                <p className="font-semibold text-stone-900">공유 버튼 탭</p>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                Safari 하단의 공유 버튼을 눌러주세요
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-900">
              2
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-stone-900" />
                <p className="font-semibold text-stone-900">
                  &quot;홈 화면에 추가&quot; 선택
                </p>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                메뉴에서 &quot;홈 화면에 추가&quot;를 찾아 눌러주세요
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-900">
              3
            </div>
            <div className="flex-1">
              <p className="font-semibold text-stone-900">&quot;추가&quot; 확인</p>
              <p className="mt-1 text-sm text-stone-500">
                우측 상단의 &quot;추가&quot; 버튼을 눌러 완료하세요
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-900">
              4
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Home className="h-5 w-5 text-stone-900" />
                <p className="font-semibold text-stone-900">홈 화면에서 열기</p>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                이제 홈 화면 아이콘을 눌러 바로 접속하세요!
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
          <Checkbox
            id="dont-show"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
          />
          <label
            htmlFor="dont-show"
            className="flex-1 cursor-pointer text-sm text-stone-600"
          >
            다시 보지 않기
          </label>
        </div>

        <div className="mt-6">
          <Button
            onClick={handleClose}
            className="w-full bg-stone-900 text-white hover:bg-stone-800"
          >
            확인
          </Button>
        </div>
      </div>
    </div>
  )
}
