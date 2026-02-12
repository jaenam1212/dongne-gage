import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('owner_id', user!.id)
    .single()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-stone-900">가게 설정</h1>
      <SettingsForm shop={shop} />
    </div>
  )
}
