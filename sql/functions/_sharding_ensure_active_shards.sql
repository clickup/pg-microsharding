CREATE OR REPLACE FUNCTION _sharding_ensure_active_shards(
  shards text[] = NULL
) RETURNS void
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
  query text := $sql$
    CREATE OR REPLACE FUNCTION _sharding_active_shards() RETURNS text[]
      LANGUAGE sql IMMUTABLE
      SET search_path FROM CURRENT
      AS $body$ SELECT %L::text[]; $body$;
    DISCARD PLANS;
  $sql$;
BEGIN
  IF shards IS NOT NULL THEN
    EXECUTE format(query, shards);
  END IF;

  -- Re-filter the list of shards by the list of actually existing schemas and
  -- re-create the function with a trully existing shards.
  shards := sharding_list_active_shards();
  EXECUTE format(query, shards);
END;
$$;

COMMENT ON FUNCTION _sharding_ensure_active_shards(text[])
  IS 'Sets the list of shards active in this database. Only active shards are returned '
     'by sharding_list_active_shards() function, and when copying a schema from one database to '
     'another via pg_dump, the schema does not become active by default on the destination.';
