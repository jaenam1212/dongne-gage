-- ============================================================
-- Shop Logos Storage Bucket (idempotent)
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-logos', 'shop-logos', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Shop owners can upload logos'
  ) THEN
    CREATE POLICY "Shop owners can upload logos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'shop-logos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Shop owners can update logos'
  ) THEN
    CREATE POLICY "Shop owners can update logos"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'shop-logos')
      WITH CHECK (bucket_id = 'shop-logos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Shop owners can delete logos'
  ) THEN
    CREATE POLICY "Shop owners can delete logos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'shop-logos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can view logos'
  ) THEN
    CREATE POLICY "Anyone can view logos"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'shop-logos');
  END IF;
END $$;
