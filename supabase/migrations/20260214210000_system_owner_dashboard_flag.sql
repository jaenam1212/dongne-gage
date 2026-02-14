ALTER TABLE shops
ADD COLUMN IF NOT EXISTS is_system_owner BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION guard_system_owner_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- service_role만 시스템 오너 플래그를 변경할 수 있음
  IF auth.role() <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_system_owner := false;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.is_system_owner := OLD.is_system_owner;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_system_owner_flag ON shops;
CREATE TRIGGER trg_guard_system_owner_flag
BEFORE INSERT OR UPDATE ON shops
FOR EACH ROW
EXECUTE FUNCTION guard_system_owner_flag();
