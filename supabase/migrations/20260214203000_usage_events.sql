CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  path TEXT,
  visitor_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_shop_created
  ON usage_events(shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_type_created
  ON usage_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_path_created
  ON usage_events(path, created_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners can view own usage events"
  ON usage_events FOR SELECT
  USING (
    shop_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM shops s
      WHERE s.id = usage_events.shop_id
        AND s.owner_id = auth.uid()
    )
  );
