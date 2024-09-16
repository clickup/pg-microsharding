CREATE OR REPLACE FUNCTION microsharding_ensure_active(
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
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = shard) THEN
      RAISE EXCEPTION 'No such schema: %', shard;
    END IF;
    shards := array_append(shards, shard);
    RETURN NEXT shard::regnamespace;
  END LOOP;
  PERFORM microsharding_ensure_active_shards_(shards);
END;
$$;

COMMENT ON FUNCTION microsharding_ensure_active(integer, integer)
  IS 'Activates a particular shards range (inclusive).';
