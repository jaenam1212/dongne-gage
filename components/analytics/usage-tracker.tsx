'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackUsageEvent } from '@/lib/usage-events'

export function UsageTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastSentRef = useRef<string>('')

  useEffect(() => {
    const query = searchParams.toString()
    const fullPath = query ? `${pathname}?${query}` : pathname
    if (!pathname || lastSentRef.current === fullPath) return
    lastSentRef.current = fullPath

    trackUsageEvent({
      eventType: 'page_view',
      path: fullPath,
      metadata: {
        referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      },
    })
  }, [pathname, searchParams])

  return null
}
