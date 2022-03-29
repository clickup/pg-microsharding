CREATE OR REPLACE FUNCTION sharding_list_shards() RETURNS text[]
LANGUAGE sql
AS $$
  SELECT array_agg(schema_name::text ORDER BY schema_name)
  FROM information_schema.schemata
  WHERE schema_name ~* '^sh\d{4}$'
$$;

COMMENT ON FUNCTION sharding_list_shards()
  IS 'Returns the list of shards (schemas) which exist in this particular database.';
