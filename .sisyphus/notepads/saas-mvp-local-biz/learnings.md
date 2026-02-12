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
