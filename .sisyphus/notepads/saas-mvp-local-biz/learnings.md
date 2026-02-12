# Learnings - SaaS MVP Local Biz

## 2026-02-12 Task 1: Project Init

### Project Setup
- **Project Name**: dong-ne-gage
- **Next.js Version**: 15 (latest)
- **Framework**: App Router, TypeScript, Tailwind CSS, ESLint
- **UI Library**: shadcn/ui (Neutral color scheme)
- **Backend**: Supabase (local development)

### Supabase Configuration
- **Migration File**: `supabase/migrations/20260212115551_init_schema.sql`
- **Local Ports** (default):
  - API: 54321
  - Studio: 54323
  - DB: 54322
- **Auth Provider**: Email/Password (default enabled)
- **Default Credentials** (local dev):
  - ANON_KEY: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`
  - SERVICE_ROLE_KEY: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU`

### Database Schema
- **Tables**: shops, products, reservations, push_subscriptions
- **Key Features**:
  - Multi-tenant architecture (shop_id foreign key)
  - Atomic reservation with `create_reservation()` function
  - RLS policies: public read, owner write
  - Indexes on FK columns and slug
  - Status enum for reservations: pending, confirmed, cancelled, completed

### RLS Policy Patterns
- **Shops**: `is_active = true` for public SELECT, `auth.uid() = owner_id` for mutations
- **Products**: Similar to shops with shop owner check via subquery
- **Reservations**: Anyone can INSERT (with privacy_agreed), only shop owners can SELECT/UPDATE
- **Push Subscriptions**: Anyone can INSERT, only shop owners can SELECT

### Layout Structure
- **Root**: `/app/layout.tsx` (Korean lang, custom metadata)
- **Shop Customer**: `/app/[shop-slug]/layout.tsx` (mobile-optimized viewport)
- **Admin**: `/app/admin/layout.tsx` (basic structure)

### Verification Results
- ✅ **Scenario 1**: Next.js dev server starts successfully (HTTP 200)
- ⏸️ **Scenario 2-4**: Requires Docker Desktop (not installed)

### Docker Dependency
- **Blocker**: Supabase local development requires Docker Desktop
- **Status**: Not installed on Windows environment
- **Next Steps**: Install Docker Desktop from https://docs.docker.com/desktop
- **After Install**: Run `npx supabase start` to apply migrations and complete verification scenarios 2-4

### Files Created
- `supabase/migrations/20260212115551_init_schema.sql` (complete schema + RLS + function)
- `app/layout.tsx` (updated with Korean lang)
- `app/[shop-slug]/layout.tsx` (customer-facing layout)
- `app/admin/layout.tsx` (admin layout)
- `.env.local.example` (template)
- `.env.local` (local dev credentials)

### Commands Reference
```bash
# Start Supabase (requires Docker)
npx supabase start

# Check Supabase status
npx supabase status

# Reset database (apply migrations)
npx supabase db reset -y

# Check migration diff
npx supabase db diff

# Start Next.js dev server
npm run dev
```

### Next Task Dependencies
- Task 2-8 can proceed with mock data if Docker unavailable
- Full integration testing requires Docker + Supabase local instance

## 2026-02-12 Task 3: Product CRUD

### Storage
- Supabase Storage: product-images bucket (public)
- Migration: `20260212220000_product_images_bucket_and_rls.sql`
- Max image size: 5MB, single image per product

### Currency Formatting
- `formatKoreanWon(amount)` → `₩150,000` (toLocaleString('ko-KR'))
- Input accepts plain numbers, display shows formatted
- Hidden input passes raw numeric value to server action

### Product Form Pattern
- Shared `ProductForm` component for create & edit
- Server action bound with `.bind(null, productId)` for edit
- Price input: visible formatted field + hidden raw value field
- Deadline: `datetime-local` input with manual ISO→local formatting

### Validation
- Server-side: title required, price > 0
- max_quantity >= reserved_count (edit only)
- Korean error messages returned as `{ error: string }`
- Client shows errors via toast + inline error box

### RLS Fix
- Admin needs to see inactive products (is_active=false)
- Added "Shop owners can view all own products" policy (subquery check)
- Without this, product list page would be empty for deactivated items

### Activation Toggle
- Custom toggle button (not shadcn Switch - not installed)
- Inline CSS for state colors (stone-900 active, stone-300 inactive)
- Immediate server action call with optimistic state

### Expired Products
- Client-side date comparison: `new Date(deadline) < new Date()`
- Shows "마감" badge with Clock icon
- No cron needed

### File Structure
```
app/admin/products/
├── page.tsx           (server: fetch products for shop)
├── product-list.tsx   (client: card list with filters & toggle)
├── product-form.tsx   (client: shared form component)
├── actions.ts         (server actions: create, update, toggle)
├── new/
│   └── page.tsx       (renders ProductForm)
└── [id]/
    └── edit/
        └── page.tsx   (server: fetch product, renders ProductForm)
```

### QA Notes
- Supabase not running (no Docker) — full e2e QA blocked
- Build passes cleanly, all routes compile
- Auth guard redirects to /admin/login correctly

## 2026-02-12 Task 2: Admin Dashboard + Auth

### Supabase Auth
- Server-side with middleware pattern (@supabase/ssr)
- Three client files: server.ts (Server Components), client.ts (Client Components), middleware.ts (Next.js middleware)
- Empty catch in server.ts setAll is intentional (Supabase official pattern)
- Middleware redirects: unauthenticated → /admin/login, authenticated on /admin/login → /admin/dashboard

### Admin Layout
- Desktop: 240px left sidebar with nav + logout
- Mobile (< 768px): sticky top header + fixed bottom tab navigation
- `AdminShell` client component wraps all authenticated admin pages
- Admin layout.tsx (Server Component) checks auth, fetches shop, renders AdminShell or bare children (login)

### Components & Pages
- shadcn/ui components: Button, Input, Label, Textarea
- react-hot-toast for success/error toast notifications
- Login: Client component with form action + useState for error/loading
- Dashboard: Server component with today's reservation count + recent 5
- Settings: Server component (data fetch) + Client form component (SettingsForm)
- Logo upload: Hidden file input + preview with object URL

### Storage
- Supabase Storage bucket: shop-logos (public)
- Upload pattern: `{shop.id}-{timestamp}.{ext}` filename
- Policies: authenticated insert, public select

### Test Data
- Seed file: supabase/seed.sql
- Test credentials: admin@test.com / TestPass123!
- Test shop: 테스트 정육점 (slug: test-butcher)

### Docker Status
- Installed Docker Desktop via winget during this task
- WSL2 installed (no-distribution) but needs system reboot
- Full Supabase integration testing blocked until reboot
- Partial QA completed: auth redirect works, login form works, error handling verified

## Task 4 - Storefront & Reservation System

### Patterns Used
- `generateMetadata()` for dynamic OG tags per page (shop + product pages)
- In-memory rate limiting via `Map<IP, {count, resetTime}>` in API route handler (simpler than Edge middleware for single endpoint)
- `supabase.rpc('create_reservation', ...)` for atomic reservation creation
- `notFound()` from `next/navigation` for 404 handling when shop/product not found
- Privacy consent with Radix Checkbox + collapsible policy text

### Conventions Maintained
- Stone color palette throughout (stone-900 primary, stone-50 bg)
- Mobile-first responsive with 768px (md:) breakpoint
- Korean UI labels for all user-facing text
- `formatKoreanWon()` for currency display
- `createClient()` from `lib/supabase/server.ts` for server components
- shadcn/ui components: Button, Input, Label, Textarea, Checkbox
- react-hot-toast for notifications
- Rounded-2xl cards with border-stone-200 and shadow-sm

### Phone Validation
- Regex: `/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/` (accepts with/without dashes)
- Normalized to 11 digits before DB save: `phone.replace(/-/g, '')`

### Rate Limiting
- IP-based: 10 req/min per IP
- Applied only to POST /api/reservations
- Returns 429 with Korean error message
- In-memory Map (resets on server restart - acceptable for MVP)

### Known Issues
- Docker not installed → Supabase local unavailable → DB-dependent QA scenarios cannot be fully tested
- Shop pages return 404 when Supabase is unavailable (expected - `notFound()` called when query returns null)
- Rate limiting verified: first 10 requests pass through, 11+ return 429

### Build
- `npx tsc --noEmit` → ZERO errors
- `npm run build` → ZERO errors, all routes registered correctly
- Next.js 16.1.6 shows "middleware" deprecation warning (recommends "proxy") - existing from Task 1, not our concern

### Files Created
- `components/customer/product-card.tsx` - product display card with badges (매진/마감)
- `components/customer/reservation-form.tsx` - full reservation flow with validation + success page
- `app/[shop-slug]/page.tsx` - shop storefront with dynamic metadata
- `app/[shop-slug]/reserve/[product-id]/page.tsx` - reservation page with unavailability handling
- `app/[shop-slug]/opengraph-image.tsx` - dynamic OG image generation
- `app/api/reservations/route.ts` - reservation API with rate limiting + server-side validation
- `app/not-found.tsx` - Korean 404 page

### Files Modified
- `app/[shop-slug]/layout.tsx` - removed static metadata (moved to page-level generateMetadata), added viewport export
- `components/ui/checkbox.tsx` - installed via shadcn CLI

## Task 5 - PWA Infrastructure (Progressive Web App)

### PWA Components Created
- `public/manifest.json` - Web App Manifest with Korean labels
- `public/sw.js` - Service Worker for push notifications (NO offline caching)
- `public/icon-192.svg` & `public/icon-512.svg` - SVG placeholder icons with 🏪 emoji
- `app/api/push/subscribe/route.ts` - Push subscription registration API
- `components/customer/pwa-install-prompt.tsx` - Android install banner (beforeinstallprompt)
- `components/customer/sw-register.tsx` - Service Worker registration component
- `app/[shop-slug]/install-guide/page.tsx` - iOS installation tutorial modal
- VAPID keys generated and added to `.env.local`

### Manifest Configuration
- **name**: "동네 가게" (full name)
- **short_name**: "동네가게" (no space)
- **theme_color**: #1c1917 (stone-900)
- **background_color**: #fafaf9 (stone-50)
- **display**: standalone
- **icons**: SVG format (192x192, 512x512) - used SVG instead of PNG for simplicity in MVP

### Service Worker Patterns
- Version management: `SW_VERSION = 'v1.0.0'`
- Push event → `showNotification()` with title, body, icon, badge, vibrate, tag
- Notification click → focus existing window or open new window with `clients.matchAll()`
- NO Cache API usage (no offline caching per requirements)
- NO background sync
- Lifecycle events: install (skipWaiting), activate (claim)

### VAPID Keys
- Generated with: `npx web-push generate-vapid-keys`
- Added to `.env.local`:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client-side)
  - `VAPID_PRIVATE_KEY` (server-side)
  - `VAPID_SUBJECT=mailto:admin@dongnegage.com`
- Library installed: `web-push` (npm package)

### Push Subscription API
- **Endpoint**: POST `/api/push/subscribe`
- **Input**: `{ endpoint, keys: { p256dh, auth }, shopId }`
- **Rate limiting**: Same pattern as reservations API (10 req/min per IP)
- **Database**: Inserts into `push_subscriptions` table with `customer_phone: null` (will be linked in Task 6)
- **Response**: 201 with `{ success: true }` or 400/500 with error

### Android Install Banner
- Detects `beforeinstallprompt` event (Android Chrome only)
- Dismissible with localStorage persistence (`pwa-install-dismissed`)
- Fixed bottom position on mobile, max-width card on desktop
- Korean text: "홈 화면에 추가하면 새 상품 알림을 받을 수 있어요!"
- "설치하기" button calls `deferredPrompt.prompt()`
- Auto-hidden after install or manual dismiss

### iOS Installation Tutorial
- **Route**: `/[shop-slug]/install-guide`
- User agent detection: iOS + Safari only (redirects back otherwise)
- Modal overlay with 4-step instructions in Korean
- Step-by-step guide with icons (Share2, Plus, Home)
- "다시 보지 않기" checkbox → `localStorage.setItem('ios-install-guide-dismissed', 'true')`
- Designed as modal (fixed overlay with backdrop blur)

### Meta Tags Added
- `<link rel="manifest" href="/manifest.json">` in root layout
- `<meta name="theme-color" content="#1c1917">` (via Viewport export)
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- `<meta name="apple-mobile-web-app-title" content="동네 가게">`

### Service Worker Registration
- Registered in `components/customer/sw-register.tsx` (client component)
- Included in root `app/layout.tsx` (runs on all pages)
- `navigator.serviceWorker.register('/sw.js')` with console logging
- No error handling UI (errors logged to console only)

### Icon Strategy
- SVG icons used instead of PNG for MVP simplicity
- Cannot generate binary PNG files in current environment
- SVG supported by modern browsers for PWA icons
- Emoji-based placeholder (🏪 store icon on stone-900 background)
- Production deployment may want actual PNG icons for better compatibility

### localStorage Keys Used
- `pwa-install-dismissed` - Android banner dismissal
- `ios-install-guide-dismissed` - iOS tutorial "don't show again"

### Integration Points
- `PwaInstallPrompt` added to `app/[shop-slug]/layout.tsx` (shows on all shop pages)
- `ServiceWorkerRegister` added to root `app/layout.tsx` (registers SW globally)
- Push subscription API ready for Task 6 integration (actual push sending)

### Build Verification
- `npm run build` → ZERO errors (✅ PRIMARY verification met)
- All new routes registered:
  - `/[shop-slug]/install-guide` (iOS tutorial)
  - `/api/push/subscribe` (subscription API)
- TypeScript compilation: SUCCESS
- Warnings (non-critical):
  - Workspace root inference (multiple lockfiles) - existing issue
  - "middleware" → "proxy" deprecation - existing from Task 1

### Known Limitations
- Service Worker only supports push notifications (no offline features)
- PWA install prompts are browser-specific (Android Chrome, iOS Safari)
- iOS requires manual installation (no programmatic prompt)
- Push notification sending not implemented (Task 6)
- No actual push subscription from client side yet (Task 6)
- SVG icons may have limited browser support (consider PNG for production)

### Next Steps (Task 6)
- Implement client-side push subscription flow
- Request notification permission
- Subscribe user with VAPID public key
- Link push subscription to customer phone number
- Send actual push notifications via web-push library
- Test push delivery on Android/iOS devices

## Task 6 - Push Notification System

### Architecture

#### Push Utility Library (`lib/push.ts`)
- Module-level `webpush.setVapidDetails()` configuration (runs once on import)
- `sendPushToShop()` function sends to all subscriptions for a shop
- Uses `Promise.allSettled()` to send to multiple subscribers in parallel
- Automatic cleanup: removes subscriptions on 410/404 status codes
- Payload format: `{ title, body, url }` - stringified JSON

#### Push API Endpoint (`/api/push/send`)
- Manual push sending for future features (admin dashboard trigger)
- Auth check: user must own the shop
- Delegates to `sendPushToShop()` utility

#### Product Actions Integration
- Updated shop query to include `name` and `slug` fields (needed for push notification)
- Push sent after successful product insert, before redirect
- Try-catch wrapper: product creation succeeds even if push fails
- Notification format: `{shop.name} 새 상품 - {title} - 지금 예약하세요!`

#### Reservation Management
- **Server Component** (`page.tsx`): fetches reservations with filters (date, status)
- **Client Component** (`reservation-list.tsx`): displays cards with status badges and action buttons
- **Server Actions** (`actions.ts`): updates status and sends push to customer

### Push Notification Patterns

#### Sending to Shop Subscribers (New Product)
```typescript
await sendPushToShop(shop.id, {
  title: `${shop.name} 새 상품`,
  body: `${title} - 지금 예약하세요!`,
  url: `/${shop.slug}`,
})
```

#### Sending to Individual Customer (Reservation Status)
```typescript
// Find subscription by shop_id AND customer_phone
const { data: subscription } = await supabase
  .from('push_subscriptions')
  .select('*')
  .eq('shop_id', reservation.shop_id)
  .eq('customer_phone', reservation.customer_phone)
  .single()

// Send directly with webpush.sendNotification()
await webpush.sendNotification(
  { endpoint, keys: { p256dh, auth } },
  JSON.stringify({ title, body, url })
)
```

### Reservation List UI

#### Filters
- **Date filters**: 전체 (all) / 오늘 (today)
- **Status filters**: 전체 / 대기중 / 확인됨 / 취소됨 / 완료
- URL-based: `/admin/reservations?date=today&status=pending`
- Simple Link components (no client-side state)

#### Status Badges
- Inline styles with Tailwind classes (no shadcn Badge component)
- Colors: yellow (pending), green (confirmed), red (cancelled), gray (completed)
- Format: `bg-{color}-50 text-{color}-700 border-{color}-200`

#### Action Buttons
- **Pending**: "확인" (confirm) / "취소" (cancel)
- **Confirmed**: "완료 처리" (complete)
- **Cancelled/Completed**: No actions
- Disabled state while updating (`updating` useState)
- Toast notifications on success/error

#### Reservation Card Layout
- Product image thumbnail (20x20, rounded-xl)
- Product title + status badge
- Customer info: name, phone
- Details: quantity, total price, pickup date, memo
- Created timestamp
- Action buttons (if applicable)

### Error Handling

#### Push Notification Failures
- Never fail the primary operation (product creation, status update)
- Log errors to console: `console.error('Push notification failed:', error)`
- Clean up expired subscriptions on 410/404 status codes
- Continue execution if push fails

#### TypeScript Types
- Installed `@types/web-push` for proper type support
- `error: any` used for web-push errors (statusCode property)
- Reservation interface with nested `products` object

### Database Queries

#### Reservation List with Product Join
```typescript
supabase
  .from('reservations')
  .select('*, products(title, price, image_url)')
  .eq('shop_id', shop.id)
  .order('created_at', { ascending: false })
```

#### Reservation with Shop and Product (for status update)
```typescript
supabase
  .from('reservations')
  .select('*, shops!inner(owner_id, name, slug), products(title)')
  .eq('id', reservationId)
  .single()
```

#### Find Customer Subscription
```typescript
supabase
  .from('push_subscriptions')
  .select('*')
  .eq('shop_id', reservation.shop_id)
  .eq('customer_phone', reservation.customer_phone)
  .single()
```

### Conventions Maintained

- **Korean UI**: All user-facing text in Korean
- **Stone color palette**: consistent with existing admin pages
- **formatKoreanWon()**: currency formatting
- **react-hot-toast**: notification pattern
- **Server actions**: `'use server'` with revalidatePath
- **Error messages**: Korean strings thrown from server actions
- **Loading states**: disabled buttons with `updating` flag

### Files Created

1. `lib/push.ts` - Push utility with sendPushToShop function
2. `app/api/push/send/route.ts` - Manual push API endpoint
3. `app/admin/reservations/page.tsx` - Server component with data fetching
4. `app/admin/reservations/reservation-list.tsx` - Client component with UI
5. `app/admin/reservations/actions.ts` - Server actions for status updates

### Files Modified

1. `app/admin/products/actions.ts` - Added push trigger on product creation
2. `package.json` - Added `@types/web-push` dev dependency

### Build Verification

- `npm run build` → SUCCESS (4.8s compilation time)
- TypeScript compilation: ZERO errors
- All routes registered including `/admin/reservations`
- Existing warnings only (workspace root, middleware deprecation)

### Known Limitations

- Push notifications require customer to have subscribed via PWA
- Customer phone number must match exactly between reservation and subscription
- No notification history/log in UI
- No retry mechanism for failed push notifications
- Subscription cleanup is automatic but not logged/reported

### Integration Points

- Task 5 PWA infrastructure: Service Worker receives push events
- Task 2 admin layout: Reservations page uses AdminShell wrapper
- Task 4 reservation API: customer_phone stored in reservations table
- Task 1 database schema: push_subscriptions table with customer_phone column

### Next Steps (Future Enhancements)

- Add navigation link to reservations page in AdminShell sidebar
- Implement notification history/audit log
- Add bulk actions (confirm all pending, etc.)
- Implement retry queue for failed push notifications
- Add admin settings for notification templates
- Real-time reservation updates with Supabase Realtime
