-- Inventory ledger-based stock management and status transition controls

-- 조회 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_reservations_product_status
  ON reservations(product_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_product_phone_status
  ON reservations(product_id, customer_phone, status);

-- 점유 상태 합계(재고 원장) 조회 함수
CREATE OR REPLACE FUNCTION get_product_reserved_quantity(p_product_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(SUM(quantity), 0)::INT
  FROM reservations
  WHERE product_id = p_product_id
    AND status IN ('pending', 'confirmed', 'completed');
$$;

-- 캐시 컬럼(products.reserved_count) 동기화 함수
CREATE OR REPLACE FUNCTION sync_product_reserved_count(p_product_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserved_qty INTEGER;
BEGIN
  v_reserved_qty := get_product_reserved_quantity(p_product_id);

  UPDATE products
  SET reserved_count = v_reserved_qty
  WHERE id = p_product_id;

  RETURN v_reserved_qty;
END;
$$;

-- 예약 생성: ledger 기반 재고/1인 제한 검증
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
RETURNS reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products;
  v_reservation reservations;
  v_reserved_qty INT;
  v_customer_total INT;
BEGIN
  IF p_quantity < 1 OR p_quantity > 99 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;

  -- 재고 검증 시 동시성 보장을 위해 상품 행 잠금
  SELECT * INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
  END IF;

  IF v_product.shop_id <> p_shop_id THEN
    RAISE EXCEPTION 'SHOP_PRODUCT_MISMATCH';
  END IF;

  v_reserved_qty := get_product_reserved_quantity(p_product_id);

  IF v_product.max_quantity IS NOT NULL
     AND (v_reserved_qty + p_quantity) > v_product.max_quantity THEN
    RAISE EXCEPTION 'STOCK_EXCEEDED: Remaining %', (v_product.max_quantity - v_reserved_qty);
  END IF;

  IF v_product.max_quantity_per_customer IS NOT NULL THEN
    SELECT COALESCE(SUM(quantity), 0)::INT INTO v_customer_total
    FROM reservations
    WHERE product_id = p_product_id
      AND customer_phone = p_customer_phone
      AND status IN ('pending', 'confirmed', 'completed');

    IF (v_customer_total + p_quantity) > v_product.max_quantity_per_customer THEN
      RAISE EXCEPTION 'PER_CUSTOMER_LIMIT: Max %', v_product.max_quantity_per_customer;
    END IF;
  END IF;

  INSERT INTO reservations (
    product_id,
    shop_id,
    customer_name,
    customer_phone,
    quantity,
    pickup_date,
    memo,
    privacy_agreed,
    status
  )
  VALUES (
    p_product_id,
    p_shop_id,
    p_customer_name,
    p_customer_phone,
    p_quantity,
    p_pickup_date,
    p_memo,
    p_privacy_agreed,
    'pending'
  )
  RETURNING * INTO v_reservation;

  PERFORM sync_product_reserved_count(p_product_id);

  RETURN v_reservation;
END;
$$;

-- 상태 전이 매트릭스
-- confirmed: pending/cancelled -> confirmed
-- cancelled: pending/confirmed/completed -> cancelled
-- completed: confirmed -> completed
CREATE OR REPLACE FUNCTION transition_reservation_status(
  p_reservation_id UUID,
  p_next_status TEXT,
  p_actor UUID DEFAULT NULL
)
RETURNS reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation reservations;
  v_owner_id UUID;
  v_product products;
  v_updated reservations;
  v_next_holds BOOLEAN;
  v_current_holds BOOLEAN;
  v_reserved_qty INT;
  v_customer_total INT;
BEGIN
  IF p_next_status NOT IN ('confirmed', 'cancelled', 'completed') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  SELECT r.*
  INTO v_reservation
  FROM reservations r
  WHERE r.id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND';
  END IF;

  SELECT s.owner_id
  INTO v_owner_id
  FROM shops s
  WHERE s.id = v_reservation.shop_id;

  IF p_actor IS NOT NULL AND v_owner_id <> p_actor THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF v_reservation.status = p_next_status THEN
    RETURN v_reservation;
  END IF;

  IF p_next_status = 'confirmed' AND v_reservation.status NOT IN ('pending', 'cancelled') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: % -> %', v_reservation.status, p_next_status;
  ELSIF p_next_status = 'cancelled' AND v_reservation.status NOT IN ('pending', 'confirmed', 'completed') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: % -> %', v_reservation.status, p_next_status;
  ELSIF p_next_status = 'completed' AND v_reservation.status NOT IN ('confirmed') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: % -> %', v_reservation.status, p_next_status;
  END IF;

  v_current_holds := v_reservation.status IN ('pending', 'confirmed', 'completed');
  v_next_holds := p_next_status IN ('pending', 'confirmed', 'completed');

  -- 비점유 -> 점유 전이 시 재고 재확보 검증
  IF NOT v_current_holds AND v_next_holds THEN
    SELECT * INTO v_product
    FROM products
    WHERE id = v_reservation.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
    END IF;

    v_reserved_qty := get_product_reserved_quantity(v_reservation.product_id);

    IF v_product.max_quantity IS NOT NULL
       AND (v_reserved_qty + v_reservation.quantity) > v_product.max_quantity THEN
      RAISE EXCEPTION 'STOCK_EXCEEDED: Remaining %', (v_product.max_quantity - v_reserved_qty);
    END IF;

    IF v_product.max_quantity_per_customer IS NOT NULL THEN
      SELECT COALESCE(SUM(quantity), 0)::INT INTO v_customer_total
      FROM reservations
      WHERE product_id = v_reservation.product_id
        AND customer_phone = v_reservation.customer_phone
        AND status IN ('pending', 'confirmed', 'completed')
        AND id <> v_reservation.id;

      IF (v_customer_total + v_reservation.quantity) > v_product.max_quantity_per_customer THEN
        RAISE EXCEPTION 'PER_CUSTOMER_LIMIT: Max %', v_product.max_quantity_per_customer;
      END IF;
    END IF;
  END IF;

  UPDATE reservations
  SET status = p_next_status,
      updated_at = now()
  WHERE id = p_reservation_id
  RETURNING * INTO v_updated;

  PERFORM sync_product_reserved_count(v_reservation.product_id);

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION get_product_reserved_quantity(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION sync_product_reserved_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_reservation(UUID, UUID, TEXT, TEXT, INT, DATE, TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION transition_reservation_status(UUID, TEXT, UUID) TO authenticated;
