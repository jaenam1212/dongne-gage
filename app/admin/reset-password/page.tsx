'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setReady(true)
      return
    }

    supabase.auth.exchangeCodeForSession(code)
      .then(({ error: exchangeError }) => {
        if (exchangeError) {
          setError('재설정 링크가 만료되었거나 유효하지 않습니다.')
        }
      })
      .finally(() => setReady(true))
  }, [searchParams, supabase.auth])

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    setMessage(null)

    const password = (formData.get('password') as string)?.trim()
    const confirmPassword = (formData.get('confirmPassword') as string)?.trim()

    if (!password || password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError('비밀번호 변경에 실패했습니다. 링크를 다시 요청해주세요.')
      setLoading(false)
      return
    }

    setMessage('비밀번호가 변경되었습니다. 로그인해 주세요.')
    setLoading(false)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-stone-900">비밀번호 재설정</h1>
        <p className="mt-1 text-xs text-stone-500">새 비밀번호를 입력해 주세요.</p>

        {!ready ? (
          <p className="mt-4 text-sm text-stone-500">링크 확인 중...</p>
        ) : (
          <form action={handleSubmit} className="mt-5 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="password">새 비밀번호</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required />
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
            {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</div>}

            <Button type="submit" disabled={loading} className="w-full bg-stone-900 text-white hover:bg-stone-800">
              {loading ? '변경 중...' : '비밀번호 변경'}
            </Button>
            <Link href="/admin/login" className="block text-center text-xs text-stone-500 hover:text-stone-700 hover:underline">
              로그인으로 이동
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
