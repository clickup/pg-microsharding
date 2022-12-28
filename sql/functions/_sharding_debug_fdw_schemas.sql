CREATE OR REPLACE FUNCTION _sharding_debug_fdw_schemas(
  dst_prefix text
) RETURNS regnamespace[]
LANGUAGE sql
SET search_path FROM CURRENT
AS $$
  SELECT COALESCE(array_agg(nspname::regnamespace ORDER BY nspname), '{}')
  FROM pg_namespace
  WHERE
    nspname LIKE (dst_prefix || '\_%')
    AND pg_catalog.obj_description(oid) LIKE 'pg_sharding:%'
$$;

COMMENT ON FUNCTION _sharding_debug_fdw_schemas(text)
  IS 'Returns the list of debug foreign shard schemas existing in the database now.';
