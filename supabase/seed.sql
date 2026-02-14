-- Seed test admin user
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '123e4567-e89b-12d3-a456-426614174000',
  'authenticated', 'authenticated',
  'admin@test.com',
  crypt('TestPass123!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  false, ''
);

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '123e4567-e89b-12d3-a456-426614174000',
  'admin@test.com',
  '{"sub":"123e4567-e89b-12d3-a456-426614174000","email":"admin@test.com"}'::jsonb,
  'email',
  now(), now(), now()
);

-- Seed test shop
INSERT INTO shops (id, owner_id, slug, name, description, phone, address) VALUES (
  '223e4567-e89b-12d3-a456-426614174000',
  '123e4567-e89b-12d3-a456-426614174000',
  'test-shop',
  '테스트 상점',
  '우리 동네의 다양한 상품을 제공합니다',
  '02-1234-5678',
  '서울시 강남구 테스트로 123'
);

-- Create storage bucket for shop logos
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-logos', 'shop-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Shop owners can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'shop-logos');

CREATE POLICY "Anyone can view logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'shop-logos');
