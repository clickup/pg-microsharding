CREATE OR REPLACE FUNCTION microsharding_debug_views_drop(
  dst_schema text = 'public'
) RETURNS SETOF text
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
  view_full_name text;
BEGIN
  FOR view_full_name IN
    SELECT format('%I.%I', dst_schema, table_name)
    FROM information_schema.views
    WHERE table_schema = dst_schema
  LOOP
    IF pg_catalog.obj_description(view_full_name::regclass) LIKE '%sharding:%' THEN
      EXECUTE format('DROP VIEW %s', view_full_name);
      RETURN NEXT view_full_name;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION microsharding_debug_views_drop(text)
  IS 'Drops all debug views previously created.';
