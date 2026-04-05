ALTER TABLE shops
ADD COLUMN IF NOT EXISTS pickup_available_weekdays INTEGER[] NOT NULL DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6];

CREATE OR REPLACE FUNCTION create_reservations_batch(
  p_shop_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_pickup_date DATE DEFAULT NULL,
  p_pickup_time TIME DEFAULT NULL,
  p_memo TEXT DEFAULT NULL,
  p_privacy_agreed BOOLEAN DEFAULT false,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_created reservations;
  v_result JSONB := '[]'::jsonb;
  v_pickup_available_weekdays INTEGER[];
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ITEMS_REQUIRED';
  END IF;

  SELECT pickup_available_weekdays
  INTO v_pickup_available_weekdays
  FROM shops
  WHERE id = p_shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHOP_NOT_FOUND';
  END IF;

  IF p_pickup_date IS NOT NULL
     AND COALESCE(array_length(v_pickup_available_weekdays, 1), 0) > 0
     AND NOT (EXTRACT(DOW FROM p_pickup_date)::INT = ANY(v_pickup_available_weekdays)) THEN
    RAISE EXCEPTION 'PICKUP_DATE_NOT_ALLOWED';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    v_created := create_reservation(
      (v_item ->> 'product_id')::UUID,
      p_shop_id,
      p_customer_name,
      p_customer_phone,
      COALESCE((v_item ->> 'quantity')::INT, 0),
      p_pickup_date,
      p_pickup_time,
      p_memo,
      p_privacy_agreed,
      CASE
        WHEN jsonb_typeof(v_item -> 'selected_options') = 'object' THEN v_item -> 'selected_options'
        ELSE NULL
      END
    );

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'id', v_created.id,
        'product_id', v_created.product_id,
        'customer_name', v_created.customer_name,
        'quantity', v_created.quantity,
        'pickup_date', v_created.pickup_date,
        'pickup_time', v_created.pickup_time,
        'status', v_created.status
      )
    );
  END LOOP;

  RETURN v_result;
END;
$$;
