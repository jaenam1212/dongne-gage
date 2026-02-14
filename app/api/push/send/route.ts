import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToShop } from '@/lib/push'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { shopId, title, body, url } = await request.json()

    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id')
      .eq('id', shopId)
      .eq('owner_id', user.id)
      .single()

    if (shopError || !shop) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    await sendPushToShop(shopId, { title, body, url })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unhandled push send API error:', error)
    return NextResponse.json(
      { error: '알림 전송에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
