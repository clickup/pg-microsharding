DO $$
BEGIN
  BEGIN
    CREATE FUNCTION _sharding_active_shards() RETURNS text[]
    LANGUAGE sql
    SET search_path FROM CURRENT
    AS $body$ SELECT '{}'::text[]; $body$;
  EXCEPTION
    WHEN duplicate_function THEN NULL;
  END;
END;
$$;

\ir ./functions/_sharding_ensure_active_shards.sql
\ir ./functions/_sharding_schema_name.sql
\ir ./functions/sharding_debug_views_create.sql
\ir ./functions/sharding_debug_views_drop.sql
\ir ./functions/sharding_ensure_absent.sql
\ir ./functions/sharding_ensure_active.sql
\ir ./functions/sharding_ensure_exist.sql
\ir ./functions/sharding_ensure_inactive.sql
\ir ./functions/sharding_list_active_shards.sql

