-- ============================================================
-- Product images (multiple images per product)
-- ============================================================

CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON product_images(product_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_product_images_shop_id
  ON product_images(shop_id);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view images of active products"
  ON product_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM products p
      WHERE p.id = product_images.product_id
        AND p.is_active = true
    )
  );

CREATE POLICY "Shop owners can view all own product images"
  ON product_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM shops s
      WHERE s.id = product_images.shop_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can insert own product images"
  ON product_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM shops s
      WHERE s.id = product_images.shop_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can update own product images"
  ON product_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM shops s
      WHERE s.id = product_images.shop_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can delete own product images"
  ON product_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM shops s
      WHERE s.id = product_images.shop_id
        AND s.owner_id = auth.uid()
    )
  );
