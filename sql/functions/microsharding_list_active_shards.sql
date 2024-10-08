CREATE OR REPLACE FUNCTION microsharding_list_active_shards() RETURNS regnamespace[]
LANGUAGE sql
SET search_path FROM CURRENT
AS $$
  SELECT COALESCE(array_agg(nspname::regnamespace ORDER BY nspname), '{}')
  FROM pg_namespace
  WHERE pg_namespace.nspname = ANY(microsharding_active_shards_())
$$;

COMMENT ON FUNCTION microsharding_list_active_shards()
  IS 'Returns the list of active shards (schemas) which exist in this particular database. '
     'Only active shards are returned, and when copying a schema from one database to '
     'another via pg_dump, the schema does not become active by default on the destination.';
