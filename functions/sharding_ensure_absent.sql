CREATE OR REPLACE FUNCTION sharding_ensure_absent(from_shard integer, to_shard integer) RETURNS SETOF text
LANGUAGE plpgsql
AS $$
DECLARE
  rec record;
BEGIN
  IF from_shard < 0 OR to_shard > 9999 OR from_shard > to_shard THEN
    RAISE EXCEPTION 'Invalid from_shard or to_shard';
  END IF;
  FOR rec IN
    WITH shards AS (
      SELECT 'sh' || lpad(n::text, 4, '0') AS shard
      FROM generate_series(from_shard, to_shard) AS n
    )
    SELECT * FROM shards
    WHERE EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = shards.shard)
  LOOP
    EXECUTE 'DROP SCHEMA ' || rec.shard;
    RETURN NEXT rec.shard;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sharding_ensure_absent(integer, integer)
  IS 'Removes EMPTY shards (schemas) in the range from_shard..to_shard (inclusive).';
