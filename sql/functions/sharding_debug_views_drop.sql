CREATE OR REPLACE FUNCTION sharding_debug_views_drop(
  dst_schema text = 'public'
) RETURNS SETOF text
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
  view_name text;
BEGIN
  FOR view_name IN
    SELECT format('%I.%I', dst_schema, table_name)
    FROM information_schema.views
    WHERE table_schema = dst_schema
  LOOP
    IF pg_catalog.obj_description(view_name::regclass) LIKE 'pg_sharding:%' THEN
      EXECUTE format('DROP VIEW %I', view_name);
      RETURN NEXT view_name;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sharding_debug_views_create(text)
  IS 'Drops all debug views previously created.';
