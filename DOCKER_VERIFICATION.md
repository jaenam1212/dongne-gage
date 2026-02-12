# Supabase Local Development - Verification Guide

## Prerequisites

Install Docker Desktop for Windows:
https://docs.docker.com/desktop/install/windows-install/

After installation, ensure Docker Desktop is running.

---

## Step 1: Start Supabase

```bash
cd dong-ne-gage
npx supabase start
```

This will:
- Download Supabase Docker images (5-10 minutes first time)
- Start all services (DB, Auth, API, Studio)
- Apply migration: `20260212115551_init_schema.sql`

Wait for output:
```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   S3 Access Key: 625729a08b95bf1b7ff351a663f3a23c
   S3 Secret Key: 850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
       S3 Region: local
```

---

## Step 2: Verify Migration Applied

```bash
npx supabase db reset -y
```

Expected: No errors, all tables created.

Check schema:
```bash
npx supabase db diff
```

Expected output:
```
No schema changes detected.
```

**✅ Scenario 2 PASS**

---

## Step 3: Test RLS Policies

Get credentials:
```bash
# From .env.local
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
```

Test anon access (should return empty, not error):
```bash
curl -s "http://localhost:54321/rest/v1/shops" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY"
```

Expected: `[]` (empty array, RLS working)

Test service role (bypasses RLS):
```bash
curl -s "http://localhost:54321/rest/v1/shops" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

Expected: `[]` (empty array, but no RLS restriction)

**✅ Scenario 3 PASS**

---

## Step 4: Test Atomic Reservation Function

Access Supabase Studio:
http://localhost:54323

Navigate to: **SQL Editor**

Run this SQL:

```sql
-- Create test user (bypass auth for testing)
INSERT INTO auth.users (id, email) VALUES 
  ('123e4567-e89b-12d3-a456-426614174000', 'test@test.com')
ON CONFLICT DO NOTHING;

-- Create test shop
INSERT INTO shops (id, owner_id, slug, name) VALUES 
  ('223e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174000', 'test-shop', 'Test Shop')
ON CONFLICT DO NOTHING;

-- Create test product with max_quantity=2
INSERT INTO products (id, shop_id, title, price, max_quantity, reserved_count, is_active) VALUES
  ('323e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174000', 'Test Product', 10000, 2, 0, true)
ON CONFLICT DO NOTHING;

-- Reservation 1 (should succeed)
SELECT create_reservation(
  '323e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174000',
  'Customer 1', '01012345678', 1, '2026-02-15', NULL, true
);

-- Reservation 2 (should succeed)
SELECT create_reservation(
  '323e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174000',
  'Customer 2', '01098765432', 1, '2026-02-15', NULL, true
);

-- Check reserved_count = 2
SELECT reserved_count FROM products WHERE id = '323e4567-e89b-12d3-a456-426614174000';
-- Expected: 2

-- Reservation 3 (should FAIL - quantity exceeded)
SELECT create_reservation(
  '323e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174000',
  'Customer 3', '01011112222', 1, '2026-02-15', NULL, true
);
-- Expected: ERROR: Quantity not available. Remaining: 0
```

**✅ Scenario 4 PASS** if:
1. First 2 reservations succeed
2. `reserved_count` updates to 2
3. Third reservation fails with "Quantity not available"

---

## Step 5: Verify Next.js Integration

Start dev server:
```bash
npm run dev
```

Open: http://localhost:3000

Expected: Next.js app loads without errors.

Check browser console - no Supabase connection errors.

---

## Troubleshooting

### Docker Issues
```bash
# Check Docker is running
docker ps

# Restart Supabase
npx supabase stop
npx supabase start
```

### Migration Issues
```bash
# Reset database completely
npx supabase db reset -y

# Check migration status
npx supabase migration list
```

### Port Conflicts
```bash
# Check what's using ports
netstat -ano | findstr :54321
netstat -ano | findstr :54322
netstat -ano | findstr :54323

# Stop Supabase
npx supabase stop
```

---

## After Verification

Once all scenarios pass, update:
`.sisyphus/notepads/saas-mvp-local-biz/learnings.md`

Change:
```
- ⏸️ **Scenario 2-4**: Requires Docker Desktop (not installed)
```

To:
```
- ✅ **Scenario 2**: Migration applies cleanly
- ✅ **Scenario 3**: RLS prevents unauthorized access  
- ✅ **Scenario 4**: Atomic reservation quantity constraint works
```

And commit:
```bash
git add .
git commit -m "docs: update verification status after Docker setup"
```

---

**Task 1 will be FULLY COMPLETE after all 4 scenarios pass.**
