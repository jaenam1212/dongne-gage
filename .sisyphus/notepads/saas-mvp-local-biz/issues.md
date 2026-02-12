# Issues - SaaS MVP Local Biz

## 2026-02-12 Task 1: Project Init

### Docker Not Installed
- **Issue**: Supabase local development requires Docker Desktop
- **Error**: `failed to inspect service: error during connect: in the default daemon configuration on Windows, the docker client must be run with elevated privileges to connect`
- **Impact**: Cannot complete Supabase verification scenarios 2-4
- **Resolution Required**: Install Docker Desktop for Windows
- **Workaround**: Use Supabase Cloud project for development (requires manual setup)

### Pending Verification Scenarios
- Scenario 2: Supabase migration applies cleanly
- Scenario 3: RLS prevents unauthorized access
- Scenario 4: Reservation quantity constraint (atomic function)

**These must be verified after Docker installation before marking Task 1 as fully complete.**

## 2026-02-12 Verification Scenarios 2-4 Blocked

### Cannot Execute Without Docker
- **Scenarios 2-4**: Require Docker Desktop to be installed and running
- **Current Status**: Docker not installed on Windows environment
- **Blocker**: `docker: command not found`
- **Impact**: Cannot verify:
  - Migration application (Scenario 2)
  - RLS policy enforcement (Scenario 3)
  - Atomic reservation function (Scenario 4)

### Manual Verification Required
- User must install Docker Desktop: https://docs.docker.com/desktop/install/windows-install/
- Follow step-by-step guide: `DOCKER_VERIFICATION.md` in project root
- All scenarios are pre-scripted and ready to execute
- Migration file is complete and tested (syntax validated)

### Alternative: Supabase Cloud
If Docker installation is not feasible:
1. Create Supabase Cloud project: https://supabase.com/dashboard
2. Link project: `npx supabase link --project-ref <project-ref>`
3. Push migration: `npx supabase db push`
4. Run verification scenarios via Supabase Studio SQL Editor

### Task 1 Status
- ✅ All code and configuration complete
- ✅ Migration file ready
- ✅ Next.js dev server verified
- ⏸️ Scenarios 2-4 pending Docker installation
- 📋 Verification guide provided: `DOCKER_VERIFICATION.md`
