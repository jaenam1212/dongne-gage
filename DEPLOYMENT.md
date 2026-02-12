# Deployment Guide - 동네 가게 SaaS MVP

## Prerequisites

- GitHub repository with all code pushed
- Vercel account (free tier is sufficient for MVP)
- Supabase project (production instance)

## Step 1: Supabase Production Setup

### 1.1 Create Production Project

1. Go to https://supabase.com/dashboard
2. Create new project: "dong-ne-gage-prod"
3. Choose region closest to target users (Korea: ap-northeast-2)
4. Save the project URL and anon key

### 1.2 Apply Migrations

```bash
# Link to production project
npx supabase link --project-ref <your-project-ref>

# Push migrations
npx supabase db push

# Verify migrations applied
npx supabase db diff
```

### 1.3 Create Storage Buckets

Run in Supabase SQL Editor:

```sql
-- Shop logos bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('shop-logos', 'shop-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Product images bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (already in migrations, but verify)
```

### 1.4 Seed Test Data (Optional)

```sql
-- Create test admin user via Supabase Auth Dashboard
-- Email: admin@test.com
-- Password: TestPass123!

-- Then create test shop
INSERT INTO shops (owner_id, slug, name, phone, is_active)
VALUES (
  '<user-id-from-auth-dashboard>',
  'test-butcher',
  '테스트 정육점',
  '02-1234-5678',
  true
);
```

## Step 2: Vercel Deployment

### 2.1 Connect GitHub Repository

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Framework Preset: Next.js (auto-detected)
4. Root Directory: `./` (default)
5. Build Command: `npm run build` (default)
6. Output Directory: `.next` (default)

### 2.2 Configure Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

**Supabase (Production)**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**VAPID Keys (from .env.local)**
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BDnCvvdIbf1xbLOzr2LK1CykctBodIkEwURfbskc5StSa_MN_iGrYt5lGS9yhAaHPajeNOj9Z99X9nKRAjXgFqQ
VAPID_PRIVATE_KEY=6M8FLpKNP_68iImdl02Fz3a7Cx4PSR9FHjV3aD2gdJM
VAPID_SUBJECT=mailto:admin@dongnegage.com
```

**Site URL (Optional)**
```
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

### 2.3 Deploy

1. Click "Deploy"
2. Wait for build to complete (~2-3 minutes)
3. Vercel will provide a URL: `https://dong-ne-gage-xxx.vercel.app`

### 2.4 Custom Domain (Optional)

1. Go to Vercel Dashboard → Settings → Domains
2. Add your custom domain (e.g., `dongnegage.com`)
3. Follow DNS configuration instructions
4. Wait for SSL certificate provisioning (~5 minutes)

## Step 3: Post-Deployment Verification

### 3.1 Basic Smoke Tests

```bash
# Landing page
curl -I https://your-domain.vercel.app/
# Expected: 200 OK

# Manifest
curl https://your-domain.vercel.app/manifest.json
# Expected: Valid JSON

# Service Worker
curl https://your-domain.vercel.app/sw.js
# Expected: JavaScript file
```

### 3.2 Full E2E Flow (Manual)

1. **Landing Page**: Visit `/` → Click "무료로 시작하기"
2. **Signup**: Create account → Should redirect to `/admin/dashboard`
3. **Product Creation**: Add product with image → Check `/your-shop-slug`
4. **Customer Reservation**: Visit shop page → Reserve product → Confirm
5. **Admin Management**: Login → View reservations → Change status
6. **PWA Install**: On mobile → Check install prompt (Android) or guide (iOS)

### 3.3 Performance Check

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run Lighthouse
lighthouse https://your-domain.vercel.app/test-butcher --view

# Check scores:
# - Performance: >70
# - Accessibility: >90
# - Best Practices: >80
# - PWA: Installable
```

## Step 4: Monitoring & Maintenance

### 4.1 Vercel Analytics (Built-in)

- Go to Vercel Dashboard → Analytics
- Monitor page views, performance, errors

### 4.2 Supabase Monitoring

- Go to Supabase Dashboard → Database → Usage
- Monitor active connections, storage, bandwidth

### 4.3 Error Tracking (Optional)

For production, consider adding:
- Sentry for error tracking
- LogRocket for session replay
- PostHog for product analytics

## Troubleshooting

### Build Fails

```bash
# Check build locally first
npm run build

# Common issues:
# - Missing environment variables
# - TypeScript errors
# - Import path issues
```

### Database Connection Issues

```bash
# Verify Supabase credentials
curl https://your-project.supabase.co/rest/v1/ \
  -H "apikey: your-anon-key"

# Should return: {"message":"The server is running"}
```

### Push Notifications Not Working

1. Verify VAPID keys are set in Vercel
2. Check Service Worker registration in browser DevTools
3. Ensure HTTPS is enabled (required for Push API)
4. Test subscription API: `POST /api/push/subscribe`

### PWA Not Installable

1. Check manifest.json is accessible via HTTPS
2. Verify Service Worker registers successfully
3. Ensure icons are accessible (192x192, 512x512)
4. Check browser console for PWA errors

## Production Checklist

- [ ] Supabase production project created
- [ ] Migrations applied to production DB
- [ ] Storage buckets created with RLS policies
- [ ] Test admin account created
- [ ] Vercel project connected to GitHub
- [ ] All environment variables configured
- [ ] First deployment successful
- [ ] Custom domain configured (if applicable)
- [ ] Landing page loads correctly
- [ ] Signup flow works end-to-end
- [ ] Admin dashboard accessible
- [ ] Product creation works with image upload
- [ ] Customer can make reservations
- [ ] Push notifications work (test on mobile)
- [ ] PWA installable on Android/iOS
- [ ] Lighthouse scores acceptable
- [ ] robots.txt and sitemap.xml accessible
- [ ] 404 page displays correctly
- [ ] Mobile responsive on all pages

## Next Steps After MVP

1. **User Feedback**: Get feedback from first customer (정육점)
2. **Iterate**: Fix bugs, improve UX based on feedback
3. **Scale**: Add more features (카카오 알림톡, analytics, etc.)
4. **Marketing**: Launch landing page, SEO optimization
5. **Monetization**: Implement pricing tiers, payment integration

## Support

For issues or questions:
- Check Vercel logs: Dashboard → Deployments → [deployment] → Logs
- Check Supabase logs: Dashboard → Logs
- Review this deployment guide
- Check Next.js documentation: https://nextjs.org/docs
