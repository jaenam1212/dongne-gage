import { Hero } from '@/components/landing/hero'
import { Features } from '@/components/landing/features'
import { CTA } from '@/components/landing/cta'

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-stone-50">
      <Hero />
      <Features />
      <CTA />
      <footer className="border-t border-stone-100 py-8 text-center text-xs text-stone-400">
        <p>&copy; 2026 동네 가게. All rights reserved.</p>
      </footer>
    </div>
  )
}
