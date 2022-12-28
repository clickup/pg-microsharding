CREATE OR REPLACE FUNCTION sharding_debug_fdw_drop(
  dst_prefix text
) RETURNS SETOF text
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
  server text;
  row_oid oid;
  dst_schema text;
BEGIN
  SET client_min_messages TO warning;

  FOR row_oid, dst_schema IN
    SELECT oid, nspname
    FROM pg_namespace
    WHERE nspname LIKE (dst_prefix || '\_%')
    ORDER BY nspname
  LOOP
    IF pg_catalog.obj_description(row_oid) LIKE 'pg_sharding:%' THEN
      EXECUTE format(
        'DROP SCHEMA %I CASCADE',
        dst_schema
      );
      RETURN NEXT dst_schema;
    END IF;
  END LOOP;

  FOR row_oid, server IN
    SELECT oid, srvname
    FROM pg_foreign_server
    WHERE srvname LIKE (dst_prefix || '\_%')
    ORDER BY srvname
  LOOP
    IF pg_catalog.obj_description(row_oid) LIKE 'pg_sharding:%' THEN
      EXECUTE format(
        'DROP SERVER %I CASCADE',
        server
      );
      RETURN NEXT server;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sharding_debug_fdw_drop(text)
  IS 'Drops all debug foreign shards schemas.';
