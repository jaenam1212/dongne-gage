// Service Worker for Push Notifications
// Version: 1.0.0
const SW_VERSION = 'v1.0.0'

// Listen for push events
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event)
  
  let data = { title: '동네 가게', body: '새 알림이 있습니다', url: '/' }
  
  try {
    if (event.data) {
      data = event.data.json()
    }
  } catch (error) {
    console.error('[SW] Failed to parse push data:', error)
  }
  
  const options = {
    body: data.body,
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    data: { url: data.url },
    vibrate: [200, 100, 200],
    tag: 'dongne-notification',
    requireInteraction: false,
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Listen for notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event)
  
  event.notification.close()
  
  const urlToOpen = event.notification.data?.url || '/'
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      // Open new window if none found
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Service Worker activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Activated:', SW_VERSION)
  event.waitUntil(clients.claim())
})

// Service Worker installation
self.addEventListener('install', (event) => {
  console.log('[SW] Installed:', SW_VERSION)
  self.skipWaiting()
})
