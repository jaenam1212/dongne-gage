# Supabase 인증 설정 (가입 시 이메일 한도 방지)

가입 시 **"email rate limit exceeded"** 가 나오지 않게 하려면 아래 설정이 필요합니다.

## 1. 이메일 확인 끄기 (필수)

1. [Supabase 대시보드](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. **Authentication** → **Providers** → **Email** 이동
4. **"Confirm email"** 옵션을 **끄기** (OFF)

이렇게 하면 가입 시 확인 메일이 발송되지 않아, 시간당 2통 제한에 걸리지 않습니다.

## 2. 이미 한도에 걸린 경우

- **1시간 정도 지난 뒤** 다시 가입 시도
- 위 1번 설정을 반드시 끈 상태에서 시도

## 3. 한도를 더 쓰고 싶다면

- **Custom SMTP** 설정 후 대시보드 **Authentication → Rate limits** 에서 `rate_limit_email_sent` 값 조정 가능
