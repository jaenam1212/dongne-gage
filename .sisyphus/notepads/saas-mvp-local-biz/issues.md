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
