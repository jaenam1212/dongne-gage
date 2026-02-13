-- 1인당 구매 수량 제한 (NULL = 제한 없음)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS max_quantity_per_customer INTEGER;

COMMENT ON COLUMN products.max_quantity_per_customer IS '1인당 최대 구매 수량, NULL이면 제한 없음';

-- create_reservation: 1인당 제한 검사 추가
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
  v_customer_total INT;
BEGIN
  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  
  -- 전체 재고 제한
  IF v_product.max_quantity IS NOT NULL THEN
    IF (v_product.reserved_count + p_quantity) > v_product.max_quantity THEN
      RAISE EXCEPTION 'Quantity not available. Remaining: %', (v_product.max_quantity - v_product.reserved_count);
    END IF;
  END IF;
  
  -- 1인당 구매 수량 제한 (같은 전화번호 기준)
  IF v_product.max_quantity_per_customer IS NOT NULL THEN
    SELECT COALESCE(SUM(quantity), 0) INTO v_customer_total
    FROM reservations
    WHERE product_id = p_product_id
      AND customer_phone = p_customer_phone
      AND status != 'cancelled';
    
    IF (v_customer_total + p_quantity) > v_product.max_quantity_per_customer THEN
      RAISE EXCEPTION 'Per customer limit. Max % per person.', v_product.max_quantity_per_customer;
    END IF;
  END IF;
  
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
