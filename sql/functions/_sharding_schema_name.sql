CREATE OR REPLACE FUNCTION _sharding_schema_name(
  shard integer
) RETURNS text
LANGUAGE sql
SET search_path FROM CURRENT
AS $$
  SELECT 'sh' || lpad($1::text, 4, '0')
$$;

COMMENT ON FUNCTION _sharding_schema_name(integer)
  IS 'Builds the shard schema name from shard number.';
