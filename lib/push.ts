import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

function ensureVapidDetails() {
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (subject && publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    return true
  }
  return false
}

export async function sendPushToShop(
  shopId: string,
  payload: {
    title: string
    body: string
    url: string
  }
) {
  const supabase = await createClient()

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('shop_id', shopId)

  if (!subscriptions || subscriptions.length === 0) return
  if (!ensureVapidDetails()) return

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload)
        )
      } catch (error: any) {
        // Remove expired/invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)
        }
        throw error
      }
    })
  )

  return results
}
