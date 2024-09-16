CREATE OR REPLACE FUNCTION microsharding_debug_fdw_drop(
  dst_prefix text
) RETURNS SETOF text
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
  server text;
  row_oid oid;
  dst_schema regnamespace;
BEGIN
  SET client_min_messages TO warning;

  FOREACH dst_schema IN ARRAY microsharding_debug_fdw_schemas_(dst_prefix) LOOP
    EXECUTE format(
      'DROP SCHEMA %I CASCADE',
      dst_schema
    );
  END LOOP;

  FOR row_oid, server IN
    SELECT oid, srvname
    FROM pg_foreign_server
    WHERE srvname LIKE (dst_prefix || '\_%')
    ORDER BY srvname
  LOOP
    IF pg_catalog.obj_description(row_oid) LIKE '%sharding:%' THEN
      EXECUTE format(
        'DROP SERVER %I CASCADE',
        server
      );
      RETURN NEXT server;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION microsharding_debug_fdw_drop(text)
  IS 'Drops all debug foreign shards schemas.';
