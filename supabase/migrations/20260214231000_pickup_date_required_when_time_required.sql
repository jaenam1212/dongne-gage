CREATE OR REPLACE FUNCTION create_reservation(
  p_product_id UUID,
  p_shop_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_quantity INT,
  p_pickup_date DATE,
  p_pickup_time TIME DEFAULT NULL,
  p_memo TEXT DEFAULT NULL,
  p_privacy_agreed BOOLEAN DEFAULT false,
  p_selected_options JSONB DEFAULT NULL
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

  IF v_product.pickup_time_required = true AND p_pickup_date IS NULL THEN
    RAISE EXCEPTION 'PICKUP_DATE_REQUIRED';
  END IF;

  IF v_product.pickup_time_required = true AND p_pickup_time IS NULL THEN
    RAISE EXCEPTION 'PICKUP_TIME_REQUIRED';
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

  PERFORM adjust_inventory_by_product_link(p_product_id, p_quantity, 'consume', p_selected_options);

  INSERT INTO reservations (
    product_id,
    shop_id,
    customer_name,
    customer_phone,
    quantity,
    pickup_date,
    pickup_time,
    memo,
    privacy_agreed,
    selected_options,
    status
  )
  VALUES (
    p_product_id,
    p_shop_id,
    p_customer_name,
    p_customer_phone,
    p_quantity,
    p_pickup_date,
    p_pickup_time,
    p_memo,
    p_privacy_agreed,
    p_selected_options,
    'pending'
  )
  RETURNING * INTO v_reservation;

  PERFORM sync_product_reserved_count(p_product_id);

  RETURN v_reservation;
END;
$$;
