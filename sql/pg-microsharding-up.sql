DO $$
BEGIN
  BEGIN
    CREATE FUNCTION microsharding_active_shards_() RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path FROM CURRENT
    AS $body$ SELECT '{}'::text[]; $body$;
  EXCEPTION
    WHEN duplicate_function THEN NULL;
  END;
END;
$$;

\ir ./functions/microsharding_debug_fdw_schemas_.sql
\ir ./functions/microsharding_ensure_active_shards_.sql
\ir ./functions/microsharding_schema_name_.sql
\ir ./functions/microsharding_debug_fdw_create.sql
\ir ./functions/microsharding_debug_fdw_drop.sql
\ir ./functions/microsharding_debug_views_create.sql
\ir ./functions/microsharding_debug_views_drop.sql
\ir ./functions/microsharding_do_on_each.sql
\ir ./functions/microsharding_ensure_absent.sql
\ir ./functions/microsharding_ensure_active.sql
\ir ./functions/microsharding_ensure_exist.sql
\ir ./functions/microsharding_ensure_inactive.sql
\ir ./functions/microsharding_list_active_shards.sql
