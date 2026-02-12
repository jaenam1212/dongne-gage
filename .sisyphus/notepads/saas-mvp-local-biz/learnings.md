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
