'use client'

import { useState, useRef } from 'react'
import { updateShop } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImagePlus, Check, Loader2 } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface Shop {
  id: string
  name: string
  description: string | null
  phone: string | null
  address: string | null
  logo_url: string | null
  kakao_channel_url: string | null
}

export function SettingsForm({ shop }: { shop: Shop | null }) {
  const [loading, setLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(shop?.logo_url ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    try {
      const result = await updateShop(formData)
      if (result.success) {
        toast.success('가게 정보가 저장되었습니다')
      }
    } catch {
      toast.error('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          className: 'text-sm font-medium',
          duration: 3000,
        }}
      />
      <form action={handleSubmit} className="space-y-5">
        <input type="hidden" name="current_logo_url" value={shop?.logo_url ?? ''} />

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-stone-700">
              가게명
            </Label>
            <Input
              id="name"
              name="name"
              defaultValue={shop?.name ?? ''}
              required
              placeholder="가게 이름을 입력하세요"
              className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-stone-700">
              설명
            </Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={shop?.description ?? ''}
              placeholder="가게에 대한 간단한 소개"
              rows={3}
              className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-stone-700">
                전화번호
              </Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={shop?.phone ?? ''}
                placeholder="02-1234-5678"
                className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-stone-700">
                주소
              </Label>
              <Input
                id="address"
                name="address"
                defaultValue={shop?.address ?? ''}
                placeholder="서울시 강남구..."
                className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-stone-700">로고 이미지</Label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100 transition-colors overflow-hidden"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="로고 미리보기"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlus className="h-6 w-6 text-stone-400" />
                )}
              </button>
              <div className="text-xs text-stone-400">
                <p>클릭하여 로고를 업로드하세요</p>
                <p>JPG, PNG (최대 2MB)</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              name="logo"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kakao_channel_url" className="text-stone-700">
              카카오 채널 URL
            </Label>
            <Input
              id="kakao_channel_url"
              name="kakao_channel_url"
              defaultValue={shop?.kakao_channel_url ?? ''}
              placeholder="https://pf.kakao.com/..."
              className="border-stone-200 bg-stone-50 focus-visible:ring-stone-400"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full bg-stone-900 text-white hover:bg-stone-800 transition-colors sm:w-auto sm:px-8"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              저장
            </>
          )}
        </Button>
      </form>
    </>
  )
}
