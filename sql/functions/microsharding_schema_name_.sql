CREATE OR REPLACE FUNCTION microsharding_schema_name_(
  shard integer
) RETURNS text
LANGUAGE sql
SET search_path FROM CURRENT
AS $$
  SELECT 'sh' || lpad($1::text, 4, '0')
$$;

COMMENT ON FUNCTION microsharding_schema_name_(integer)
  IS 'Builds the shard schema name from shard number.';
