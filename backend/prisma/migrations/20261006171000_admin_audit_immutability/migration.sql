-- Audit payloads are append-only. Retention deletion is limited to records older than 365 days.
CREATE FUNCTION guard_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.created_at < CURRENT_TIMESTAMP - INTERVAL '365 days' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Admin audit is append-only';
END;
$$;
CREATE TRIGGER admin_audit_immutable BEFORE UPDATE OR DELETE ON admin_audit
FOR EACH ROW EXECUTE FUNCTION guard_admin_audit();
