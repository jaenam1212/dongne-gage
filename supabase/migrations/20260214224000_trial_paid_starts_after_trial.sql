CREATE OR REPLACE FUNCTION public.recompute_shop_billing_state(p_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop shops%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_days integer := 0;
  v_read_only boolean := false;
  v_status text := 'trialing';
  v_has_active_subscription boolean := false;
BEGIN
  SELECT * INTO v_shop
  FROM shops
  WHERE id = p_shop_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_shop.is_system_owner THEN
    v_read_only := false;
    v_status := 'active';
  ELSE
    IF v_shop.trial_ends_at IS NOT NULL THEN
      v_days := CEIL(EXTRACT(EPOCH FROM (v_shop.trial_ends_at - v_now)) / 86400.0);
    ELSE
      v_days := -1;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM shop_subscriptions ss
      WHERE ss.shop_id = v_shop.id
        AND ss.status = 'active'
        AND (
          ss.current_period_end IS NULL
          OR ss.current_period_end >= v_now
          OR ss.current_period_start > v_now
        )
    ) INTO v_has_active_subscription;

    IF v_days >= 0 THEN
      -- 무료체험 중 결제했어도 무료기간을 끝까지 유지
      v_read_only := false;
      v_status := 'trialing';
    ELSIF v_has_active_subscription THEN
      v_read_only := false;
      v_status := 'active';
    ELSE
      v_read_only := true;
      v_status := 'past_due';
    END IF;
  END IF;

  UPDATE shops
  SET
    read_only_mode = v_read_only,
    billing_status = v_status,
    billing_updated_at = v_now
  WHERE id = v_shop.id;

  RETURN;
END;
$$;
