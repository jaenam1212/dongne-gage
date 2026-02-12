'use client'

import { useState } from 'react'
import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-stone-50 via-amber-50/30 to-stone-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-white text-xl font-bold tracking-tighter">
            동
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            관리자 로그인
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            가게 관리 페이지에 접속합니다
          </p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-stone-700">
              이메일
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="admin@example.com"
              required
              autoComplete="email"
              className="h-11 border-stone-200 bg-white focus-visible:ring-stone-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-stone-700">
              비밀번호
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              required
              autoComplete="current-password"
              className="h-11 border-stone-200 bg-white focus-visible:ring-stone-400"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full bg-stone-900 text-white hover:bg-stone-800 transition-colors"
          >
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>
      </div>
    </div>
  )
}
