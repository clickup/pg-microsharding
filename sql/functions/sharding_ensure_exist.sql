CREATE OR REPLACE FUNCTION sharding_ensure_exist(
  shard_from integer,
  shard_to integer = NULL
) RETURNS SETOF regnamespace
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
  shard text;
BEGIN
  shard_to := COALESCE(shard_to, shard_from);
  IF shard_from < 0 OR shard_to > 9999 THEN
    RAISE EXCEPTION 'Invalid shard_from or shard_to';
  END IF;
  FOR shard IN
    WITH shards AS (
      SELECT _sharding_schema_name(n) AS shard
      FROM generate_series(shard_from, shard_to) AS n
    )
    SELECT shards.shard FROM shards
    WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = shards.shard)
    ORDER BY shards.shard
  LOOP
    EXECUTE format('CREATE SCHEMA %I', shard);
    RETURN NEXT shard::regnamespace;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sharding_ensure_exist(integer, integer)
  IS 'Creates shards (schemas) in the range shard_from..shard_to (inclusive).';
