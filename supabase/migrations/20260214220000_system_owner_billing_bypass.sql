CREATE OR REPLACE FUNCTION recompute_shop_billing_state(p_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_shop shops;
  v_next_status TEXT;
  v_read_only BOOLEAN;
BEGIN
  SELECT * INTO v_shop
  FROM shops
  WHERE id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_shop.is_system_owner THEN
    v_next_status := v_shop.billing_status;
    v_read_only := false;
  ELSIF v_shop.billing_status = 'active' THEN
    v_next_status := 'active';
    v_read_only := false;
  ELSIF now() <= v_shop.trial_ends_at THEN
    v_next_status := 'trialing';
    v_read_only := false;
  ELSE
    v_next_status := 'past_due';
    v_read_only := true;
  END IF;

  UPDATE shops
  SET
    billing_status = v_next_status,
    read_only_mode = v_read_only,
    billing_updated_at = now()
  WHERE id = p_shop_id;
END;
$$;
