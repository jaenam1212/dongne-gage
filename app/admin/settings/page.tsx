import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-stone-900">가게 설정</h1>
      <SettingsForm shop={shop} />
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-2">
        <h2 className="text-sm font-semibold text-stone-900">개발자 연락처</h2>
        <p className="text-sm text-stone-700">대표자 : 이재남</p>
        <p className="text-sm text-stone-700">
          이메일 :{' '}
          <a
            href="mailto:jaenam2003@naver.com"
            className="text-stone-900 underline underline-offset-2 hover:text-stone-700"
          >
            jaenam2003@naver.com
          </a>
        </p>
        <p className="text-xs text-stone-500">
          문의사항, 오류, 추가하고 싶은 기능이 있으면 언제든지 연락해주세요.
        </p>
      </section>
    </div>
  )
}
