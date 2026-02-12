-- Multi-tenant shops
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  kakao_channel_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Products/Promotions
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- 원 단위
  image_url TEXT,
  max_quantity INTEGER, -- NULL = unlimited
  reserved_count INTEGER DEFAULT 0,
  deadline TIMESTAMPTZ, -- 예약 마감일
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reservations (pre-orders)
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  pickup_date DATE,
  memo TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  privacy_agreed BOOLEAN NOT NULL DEFAULT true, -- 개인정보 동의 필수
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Push subscriptions (PWA)
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  customer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_products_shop_id ON products(shop_id);
CREATE INDEX idx_reservations_shop_id ON reservations(shop_id);
CREATE INDEX idx_reservations_product_id ON reservations(product_id);
CREATE INDEX idx_reservations_customer_phone ON reservations(customer_phone);
CREATE INDEX idx_shops_slug ON shops(slug);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Shops: 누구나 읽기, owner만 쓰기
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public shops are viewable by everyone" 
  ON shops FOR SELECT 
  USING (is_active = true);

CREATE POLICY "Users can insert their own shop" 
  ON shops FOR INSERT 
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own shop" 
  ON shops FOR UPDATE 
  USING (auth.uid() = owner_id);

-- Products: 누구나 읽기 (활성만), owner만 쓰기
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active products are viewable by everyone" 
  ON products FOR SELECT 
  USING (is_active = true);

CREATE POLICY "Shop owners can insert products" 
  ON products FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.owner_id = auth.uid())
  );

CREATE POLICY "Shop owners can update own products" 
  ON products FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.owner_id = auth.uid())
  );

CREATE POLICY "Shop owners can delete own products" 
  ON products FOR DELETE 
  USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.owner_id = auth.uid())
  );

-- Reservations: 누구나 생성, owner만 읽기/수정
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create reservations" 
  ON reservations FOR INSERT 
  WITH CHECK (privacy_agreed = true);

CREATE POLICY "Shop owners can view reservations" 
  ON reservations FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.owner_id = auth.uid())
  );

CREATE POLICY "Shop owners can update reservations" 
  ON reservations FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.owner_id = auth.uid())
  );

-- Push subscriptions: 누구나 생성, owner만 읽기
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe to push" 
  ON push_subscriptions FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Shop owners can view subscriptions" 
  ON push_subscriptions FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.owner_id = auth.uid())
  );

-- ============================================================
-- DB FUNCTION: create_reservation (atomic quantity check)
-- ============================================================

CREATE OR REPLACE FUNCTION create_reservation(
  p_product_id UUID,
  p_shop_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_quantity INT,
  p_pickup_date DATE,
  p_memo TEXT,
  p_privacy_agreed BOOLEAN
)
RETURNS reservations AS $$
DECLARE
  v_product products;
  v_reservation reservations;
BEGIN
  -- Lock product row for update
  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  
  -- Check if quantity available
  IF v_product.max_quantity IS NOT NULL THEN
    IF (v_product.reserved_count + p_quantity) > v_product.max_quantity THEN
      RAISE EXCEPTION 'Quantity not available. Remaining: %', (v_product.max_quantity - v_product.reserved_count);
    END IF;
  END IF;
  
  -- Create reservation
  INSERT INTO reservations (
    product_id, shop_id, customer_name, customer_phone,
    quantity, pickup_date, memo, privacy_agreed, status
  ) VALUES (
    p_product_id, p_shop_id, p_customer_name, p_customer_phone,
    p_quantity, p_pickup_date, p_memo, p_privacy_agreed, 'pending'
  ) RETURNING * INTO v_reservation;
  
  UPDATE products 
  SET reserved_count = reserved_count + p_quantity 
  WHERE id = p_product_id;
  
  RETURN v_reservation;
END;
$$ LANGUAGE plpgsql;
