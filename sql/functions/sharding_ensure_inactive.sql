CREATE OR REPLACE FUNCTION sharding_ensure_inactive(
  shard_from integer,
  shard_to integer = NULL
) RETURNS SETOF regnamespace
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
  shards text[] := sharding_list_active_shards();
  shard text;
BEGIN
  shard_to := COALESCE(shard_to, shard_from);
  FOR shard IN
    SELECT _sharding_schema_name(n)
    FROM generate_series(shard_from, shard_to) AS n
  LOOP
    IF shard = ANY(shards) THEN
      shards := array_remove(shards, shard);
      RETURN NEXT shard::regnamespace;
    END IF;
  END LOOP;
  PERFORM _sharding_ensure_active_shards(shards);
END;
$$;

COMMENT ON FUNCTION sharding_ensure_inactive(integer, integer)
  IS 'Deactivates a particular shards range (inclusive).';
