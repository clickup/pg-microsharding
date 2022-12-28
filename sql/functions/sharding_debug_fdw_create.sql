CREATE OR REPLACE FUNCTION sharding_debug_fdw_create(
  dst_prefix text,
  src_hosts text[]
) RETURNS TABLE (
  server text,
  shard_count integer
)
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
  host text;
  schemas text[];
  src_schema text;
  dst_schema text;
BEGIN
  FOREACH host IN ARRAY src_hosts LOOP
    server := dst_prefix || '_' || regexp_replace(host, '[^a-zA-Z0-9]+', '_', 'g');
    EXECUTE format(
      'CREATE SERVER %I FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host %L, dbname %L, port %L)',
      server,
      host,
      current_database(),
      current_setting('port')
    );
    EXECUTE format(
      'COMMENT ON SERVER %I IS %L',
      server,
      'pg_sharding:' || host
    );
    EXECUTE format(
      'CREATE USER MAPPING FOR CURRENT_USER SERVER %I OPTIONS(user %L)',
      server,
      current_user
    );

    SELECT *
      FROM public.dblink(server, format('SELECT %I.sharding_list_active_shards()', current_schema())) AS t(schemas text[])
      INTO schemas;
    FOREACH src_schema IN ARRAY schemas LOOP
      dst_schema := dst_prefix || '_' || src_schema;
      EXECUTE format(
        'CREATE SCHEMA %I',
        dst_schema
      );
      EXECUTE format(
        'COMMENT ON SCHEMA %I IS %L',
        dst_schema,
        'pg_sharding:' || host
      );
      EXECUTE format(
        'IMPORT FOREIGN SCHEMA %I FROM SERVER %I INTO %I',
        src_schema,
        server,
        dst_schema
      );
    END LOOP;

    shard_count := cardinality(schemas);
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sharding_debug_fdw_create(text, text[])
  IS 'Created debug foreign shards schemas. For each host in the list, '
     'enumerates all its shards schemas and runs IMPORT FOREIGN SCHEMA '
     'for them adding the prefix to the destination schena''s name.';
