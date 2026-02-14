ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS stock_option_name TEXT;

CREATE TABLE IF NOT EXISTS inventory_option_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  option_value TEXT NOT NULL,
  current_quantity INTEGER NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (inventory_item_id, option_value)
);

CREATE INDEX IF NOT EXISTS idx_inventory_option_stocks_inventory_item_id
  ON inventory_option_stocks(inventory_item_id);

ALTER TABLE inventory_option_stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners can view option stocks"
  ON inventory_option_stocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM inventory_items ii
      JOIN shops s ON s.id = ii.shop_id
      WHERE ii.id = inventory_option_stocks.inventory_item_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can insert option stocks"
  ON inventory_option_stocks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM inventory_items ii
      JOIN shops s ON s.id = ii.shop_id
      WHERE ii.id = inventory_option_stocks.inventory_item_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can update option stocks"
  ON inventory_option_stocks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM inventory_items ii
      JOIN shops s ON s.id = ii.shop_id
      WHERE ii.id = inventory_option_stocks.inventory_item_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can delete option stocks"
  ON inventory_option_stocks FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM inventory_items ii
      JOIN shops s ON s.id = ii.shop_id
      WHERE ii.id = inventory_option_stocks.inventory_item_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION adjust_inventory_by_product_link(
  p_product_id UUID,
  p_sale_quantity INT,
  p_mode TEXT,
  p_selected_options JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_required INT;
  v_selected_value TEXT;
  v_option_stock RECORD;
BEGIN
  IF p_sale_quantity <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;

  IF p_mode NOT IN ('consume', 'restore') THEN
    RAISE EXCEPTION 'INVALID_MODE';
  END IF;

  FOR v_link IN
    SELECT
      pil.inventory_item_id,
      pil.consume_per_sale,
      ii.current_quantity,
      ii.name AS inventory_name,
      ii.is_active,
      ii.stock_option_name
    FROM product_inventory_links pil
    JOIN inventory_items ii ON ii.id = pil.inventory_item_id
    WHERE pil.product_id = p_product_id
      AND pil.is_enabled = true
    FOR UPDATE OF ii
  LOOP
    v_required := p_sale_quantity * GREATEST(v_link.consume_per_sale, 1);

    IF v_link.stock_option_name IS NOT NULL
       AND p_selected_options IS NOT NULL
       AND jsonb_typeof(p_selected_options) = 'object' THEN
      v_selected_value := NULLIF(TRIM(p_selected_options ->> v_link.stock_option_name), '');
    ELSE
      v_selected_value := NULL;
    END IF;

    IF v_selected_value IS NOT NULL THEN
      SELECT *
      INTO v_option_stock
      FROM inventory_option_stocks ios
      WHERE ios.inventory_item_id = v_link.inventory_item_id
        AND ios.option_value = v_selected_value
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INVENTORY_OPTION_NOT_FOUND: % - %', v_link.stock_option_name, v_selected_value;
      END IF;

      IF p_mode = 'consume' THEN
        IF NOT v_link.is_active THEN
          RAISE EXCEPTION 'INVENTORY_INACTIVE: %', v_link.inventory_name;
        END IF;
        IF v_option_stock.current_quantity < v_required THEN
          RAISE EXCEPTION 'INVENTORY_OPTION_SHORTAGE: % - %', v_link.stock_option_name, v_selected_value;
        END IF;
        IF v_link.current_quantity < v_required THEN
          RAISE EXCEPTION 'INVENTORY_SHORTAGE: %', v_link.inventory_name;
        END IF;

        UPDATE inventory_option_stocks
        SET current_quantity = current_quantity - v_required,
            updated_at = now()
        WHERE id = v_option_stock.id;

        UPDATE inventory_items
        SET current_quantity = current_quantity - v_required,
            updated_at = now()
        WHERE id = v_link.inventory_item_id;
      ELSE
        UPDATE inventory_option_stocks
        SET current_quantity = current_quantity + v_required,
            updated_at = now()
        WHERE id = v_option_stock.id;

        UPDATE inventory_items
        SET current_quantity = current_quantity + v_required,
            updated_at = now()
        WHERE id = v_link.inventory_item_id;
      END IF;
    ELSE
      IF p_mode = 'consume' THEN
        IF NOT v_link.is_active THEN
          RAISE EXCEPTION 'INVENTORY_INACTIVE: %', v_link.inventory_name;
        END IF;
        IF v_link.current_quantity < v_required THEN
          RAISE EXCEPTION 'INVENTORY_SHORTAGE: %', v_link.inventory_name;
        END IF;
        UPDATE inventory_items
        SET current_quantity = current_quantity - v_required,
            updated_at = now()
        WHERE id = v_link.inventory_item_id;
      ELSE
        UPDATE inventory_items
        SET current_quantity = current_quantity + v_required,
            updated_at = now()
        WHERE id = v_link.inventory_item_id;
      END IF;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION create_reservation(
  p_product_id UUID,
  p_shop_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_quantity INT,
  p_pickup_date DATE,
  p_memo TEXT,
  p_privacy_agreed BOOLEAN,
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

    PERFORM adjust_inventory_by_product_link(
      v_reservation.product_id,
      v_reservation.quantity,
      'consume',
      v_reservation.selected_options
    );
  ELSIF v_current_holds AND NOT v_next_holds THEN
    PERFORM adjust_inventory_by_product_link(
      v_reservation.product_id,
      v_reservation.quantity,
      'restore',
      v_reservation.selected_options
    );
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

GRANT EXECUTE ON FUNCTION adjust_inventory_by_product_link(UUID, INT, TEXT, JSONB) TO authenticated, anon;
