CREATE OR REPLACE FUNCTION sharding_ensure_absent(
  shard_from integer,
  shard_to integer = NULL
) RETURNS SETOF text
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
  shard text;
BEGIN
  shard_to := COALESCE(shard_to, shard_from);
  IF shard_from < 0 OR shard_to > 9999 OR shard_from > shard_to THEN
    RAISE EXCEPTION 'Invalid shard_from or shard_to';
  END IF;
  FOR shard IN
    WITH shards AS (
      SELECT _sharding_schema_name(n) AS shard
      FROM generate_series(shard_from, shard_to) AS n
    )
    SELECT shards.shard FROM shards
    WHERE EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = shards.shard)
    ORDER BY shards.shard
  LOOP
    EXECUTE format('DROP SCHEMA %I', shard);
    RETURN NEXT shard;
  END LOOP;
  PERFORM _sharding_ensure_active_shards();
END;
$$;

COMMENT ON FUNCTION sharding_ensure_absent(integer, integer)
  IS 'Removes EMPTY shards (schemas) in the range shard_from..shard_to (inclusive).';
