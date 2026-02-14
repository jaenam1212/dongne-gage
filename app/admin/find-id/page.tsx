'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { findLoginId } from '../login/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function FindIdPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setMessage(null)
    setError(null)
    const result = await findLoginId(formData)
    if (result?.error) setError(result.error)
    if (result?.success) setMessage(result.success)
    setLoading(false)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <Link href="/admin/login" className="mb-4 inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700">
          <ArrowLeft className="h-3.5 w-3.5" />
          로그인으로 돌아가기
        </Link>
        <h1 className="text-lg font-bold text-stone-900">아이디 찾기</h1>
        <p className="mt-1 text-xs text-stone-500">가입 시 입력한 가게명과 전화번호를 입력하세요.</p>

        <form action={handleSubmit} className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="shopName">가게명</Label>
            <Input id="shopName" name="shopName" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">전화번호</Label>
            <Input id="phone" name="phone" type="tel" required placeholder="010-1234-5678" />
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</div>}

          <Button type="submit" disabled={loading} className="w-full bg-stone-900 text-white hover:bg-stone-800">
            {loading ? '조회 중...' : '아이디 찾기'}
          </Button>
        </form>
      </div>
    </div>
  )
}
