'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft } from 'lucide-react'
import { signUp } from './actions'
import toast, { Toaster } from 'react-hot-toast'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [shopName, setShopName] = useState('')
  const [suggestedSlug, setSuggestedSlug] = useState('')
  const [error, setError] = useState<string | null>(null)

  // 가게 URL은 영문 소문자, 숫자, 하이픈만 허용 (한글 불가)
  function generateSlug(name: string): string {
    const raw = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
    return raw || 'shop'
  }

  function handleShopNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value
    setShopName(name)
    if (name.trim()) {
      setSuggestedSlug(generateSlug(name))
    } else {
      setSuggestedSlug('')
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await signUp(formData)

    if (result?.error) {
      setError(result.error)
      toast.error(result.error)
      setLoading(false)
    } else {
      toast.success('가입이 완료되었습니다!')
      router.push('/admin/dashboard')
    }
  }

  return (
    <>
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium', duration: 3000 }} />

      <div className="min-h-dvh bg-stone-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            홈으로 돌아가기
          </Link>

          <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-stone-900">가입하기</h1>
            <p className="mt-2 text-sm text-stone-500">
              5분이면 충분합니다
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">이메일 <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="your@email.com"
                  className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">비밀번호 <span className="text-red-500">*</span></Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="최소 8자"
                  className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopName">가게 이름 <span className="text-red-500">*</span></Label>
                <Input
                  id="shopName"
                  name="shopName"
                  required
                  value={shopName}
                  onChange={handleShopNameChange}
                  placeholder="예: 테스트 정육점"
                  className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">가게 URL <span className="text-red-500">*</span></Label>
                <Input
                  id="slug"
                  name="slug"
                  required
                  value={suggestedSlug}
                  onChange={(e) => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, '')
                    setSuggestedSlug(v)
                  }}
                  placeholder="my-shop"
                  className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
                />
                <p className="text-xs text-stone-400">
                  영문 소문자, 숫자, 하이픈(-)만 사용 가능 · dongnegage.com/{suggestedSlug || 'my-shop'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">전화번호</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="010-1234-5678"
                  className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-stone-900 text-white hover:bg-stone-800"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    가입 처리 중...
                  </>
                ) : (
                  '가입하기'
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-stone-500">
              이미 계정이 있으신가요?{' '}
              <Link href="/admin/login" className="font-medium text-stone-900 hover:underline">
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
