ALTER TABLE shops
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'trialing',
ADD COLUMN IF NOT EXISTS plan_code TEXT NOT NULL DEFAULT 'starter_monthly',
ADD COLUMN IF NOT EXISTS read_only_mode BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS billing_customer_key TEXT,
ADD COLUMN IF NOT EXISTS billing_last_notified_days INT[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS billing_updated_at TIMESTAMPTZ;

UPDATE shops
SET
  trial_started_at = COALESCE(trial_started_at, created_at, now()),
  trial_ends_at = COALESCE(trial_ends_at, COALESCE(created_at, now()) + INTERVAL '3 months'),
  billing_status = COALESCE(NULLIF(billing_status, ''), 'trialing'),
  billing_updated_at = COALESCE(billing_updated_at, now())
WHERE trial_started_at IS NULL
   OR trial_ends_at IS NULL
   OR billing_updated_at IS NULL;

ALTER TABLE shops
ALTER COLUMN trial_started_at SET NOT NULL,
ALTER COLUMN trial_ends_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shops_billing_status_check'
  ) THEN
    ALTER TABLE shops
    ADD CONSTRAINT shops_billing_status_check
    CHECK (billing_status IN ('trialing', 'active', 'past_due', 'cancelled'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS shop_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL DEFAULT 'toss',
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  billing_key TEXT,
  customer_key TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,
  next_billing_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_status
  ON shop_subscriptions(status, current_period_end);

CREATE TABLE IF NOT EXISTS shop_billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'toss',
  event_type TEXT NOT NULL,
  event_status TEXT,
  order_id TEXT,
  payment_key TEXT,
  amount INTEGER,
  currency TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_billing_events_shop_created
  ON shop_billing_events(shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_billing_events_order
  ON shop_billing_events(order_id);

ALTER TABLE shop_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners can view own subscriptions"
  ON shop_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM shops s
      WHERE s.id = shop_subscriptions.shop_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can view own billing events"
  ON shop_billing_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM shops s
      WHERE s.id = shop_billing_events.shop_id
        AND s.owner_id = auth.uid()
    )
  );

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

  IF v_shop.billing_status = 'active' THEN
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
