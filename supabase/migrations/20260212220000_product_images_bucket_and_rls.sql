-- ============================================================
-- Product Images Storage Bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Shop owners can upload product images
CREATE POLICY "Shop owners can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Anyone can view product images
CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

-- Shop owners can delete their product images
CREATE POLICY "Shop owners can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');

-- ============================================================
-- Fix RLS: Shop owners must see ALL their products (incl. inactive)
-- ============================================================

CREATE POLICY "Shop owners can view all own products" 
  ON products FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.owner_id = auth.uid())
  );
