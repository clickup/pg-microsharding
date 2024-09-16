CREATE OR REPLACE FUNCTION microsharding_ensure_inactive(
  shard_from integer,
  shard_to integer = NULL
) RETURNS SETOF regnamespace
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
  shards text[] := microsharding_list_active_shards();
  shard text;
BEGIN
  shard_to := COALESCE(shard_to, shard_from);
  FOR shard IN
    SELECT microsharding_schema_name_(n)
    FROM generate_series(shard_from, shard_to) AS n
  LOOP
    IF shard = ANY(shards) THEN
      shards := array_remove(shards, shard);
      RETURN NEXT shard::regnamespace;
    END IF;
  END LOOP;
  PERFORM microsharding_ensure_active_shards_(shards);
END;
$$;

COMMENT ON FUNCTION microsharding_ensure_inactive(integer, integer)
  IS 'Deactivates a particular shards range (inclusive).';
