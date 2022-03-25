CREATE OR REPLACE FUNCTION sharding_list_shards() RETURNS text[] LANGUAGE sql AS $$
  SELECT array_agg(schema_name::text ORDER BY schema_name)
  FROM information_schema.schemata
  WHERE schema_name ~* '^sh\d{4}$'
$$;

COMMENT ON FUNCTION sharding_list_shards()
  IS 'Returns the list of shards (schemas) which exist in this particular database.';


CREATE OR REPLACE FUNCTION sharding_ensure_exist(from_shard integer, to_shard integer)
RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE
  rec record;
BEGIN
  IF from_shard < 0 OR to_shard > 9999 THEN
    RAISE EXCEPTION 'Invalid from_shard or to_shard';
  END IF;
  FOR rec IN
    WITH shards AS (
      SELECT 'sh' || lpad(n::text, 4, '0') AS shard
      FROM generate_series(from_shard, to_shard) AS n
    )
    SELECT * FROM shards
    WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = shards.shard)
  LOOP
    EXECUTE 'CREATE SCHEMA ' || rec.shard;
    RETURN NEXT rec.shard;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sharding_ensure_exist(integer, integer)
  IS 'Creates shards (schemas) in the range from_shard..to_shard (inclusive).';


CREATE OR REPLACE FUNCTION sharding_ensure_absent(from_shard integer, to_shard integer)
RETURNS SETOF text LANGUAGE plpgsql AS $$
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


CREATE OR REPLACE FUNCTION sharding_debug_views_create(dst_schema text = 'public') RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE
  rec record;
  view_name text;
  selects text[];
  schema text;
  all_columns text[];
  table_columns text[];
  sql text;
  hash text;
  existing_hash text;
BEGIN
  -- Iterate over all tables; for each table collect all schemas it's in and
  -- also the outer list of columns in all schemas for this table.
  FOR rec IN
    -- TODO: this can be greatly speeded up by using pg_catalog.
    SELECT
      columns.table_name::text,
      array_agg(DISTINCT columns.table_schema::text) AS schemas,
      array_agg(DISTINCT columns.column_name::text) AS columns
    FROM information_schema.columns
    WHERE 
      columns.table_schema::text = ANY(sharding_list_shards())
      AND columns.table_name ~* '^[a-zA-Z0-9_]+$'
    GROUP BY columns.table_name
    HAVING NOT EXISTS(
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = dst_schema
        AND t.table_name = table_name
        AND t.table_type = 'VIEW'
    )
  LOOP
    -- rec: table, [s1, s2, ...], [c1, c2, ...]
    view_name := format('%I.%I', dst_schema, rec.table_name);
    all_columns := array_agg(c ORDER BY c = 'id' DESC, c)
      FROM unnest(rec.columns) c;

    -- Build the list of SELECTs subject to UNION ALL.
    selects := '{}';
    FOR schema, table_columns IN
      -- TODO: this can be greatly speeded up by using pg_catalog.
      SELECT columns.table_schema, array_agg(columns.column_name::text)
      FROM information_schema.columns
      WHERE columns.table_schema = ANY(rec.schemas) AND columns.table_name = rec.table_name
      GROUP BY 1
    LOOP
      selects := array_append(selects, format(
        '  SELECT %L, %s FROM %I.%I',
        schema,
        (
          SELECT string_agg(
            CASE WHEN c = ANY(table_columns) THEN quote_ident(c) ELSE 'NULL' END,
            ', '
          ) FROM unnest(all_columns) c
        ),
        schema,
        rec.table_name
      ));
    END LOOP;

    -- The view creation query.
    sql := format(
      E'CREATE OR REPLACE VIEW %s(shard, %s) AS\n%s',
      view_name,
      (SELECT string_agg(quote_ident(c), ', ') FROM unnest(all_columns) c),
      array_to_string(selects, E' UNION ALL\n')
    );
    hash := 'pg_sharding:' || md5(sql);

    -- Update the view only if something is changed.
    existing_hash := '';
    BEGIN
      existing_hash := pg_catalog.obj_description(view_name::regclass);
    EXCEPTION
      WHEN OTHERS THEN -- skip
    END;
    IF existing_hash IS DISTINCT FROM hash THEN
      EXECUTE sql;
      EXECUTE format('COMMENT ON VIEW %s IS %L', view_name, hash);
      RETURN NEXT view_name;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sharding_debug_views_create(text)
  IS 'Creates debug views, one per table in shards. Each view unions data from all shards related to the particular table.';


CREATE OR REPLACE FUNCTION sharding_debug_views_drop(dst_schema text = 'public') RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE
  view_name text;
BEGIN
  FOR view_name IN
    SELECT format('%I.%I', dst_schema, table_name)
    FROM information_schema.views
    WHERE table_schema = dst_schema
  LOOP
    IF pg_catalog.obj_description(view_name::regclass) LIKE 'pg_sharding:%' THEN
      EXECUTE format('DROP VIEW %s', view_name);
      RETURN NEXT view_name;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sharding_debug_views_create(text)
  IS 'Drops all debug views previously created.';


CREATE OR REPLACE FUNCTION sharding_do_on_each(cmd text, OUT shard text, out row_count text) RETURNS SETOF record LANGUAGE plpgsql AS $$
DECLARE
  sql text;
BEGIN
  cmd := trim(cmd);
  FOREACH shard IN ARRAY sharding_list_shards() LOOP
    IF regexp_replace(shard, '[^0-9]', '', 'g')::integer <> 0 THEN
      BEGIN
        PERFORM set_config('search_path', shard || ',public', true);
        EXECUTE cmd;
        GET DIAGNOSTICS row_count = ROW_COUNT;
        IF row_count = '0' THEN
          row_count = '';
        END IF;
        RETURN NEXT;
      EXCEPTION
        WHEN others THEN
          RAISE NOTICE 'error when running SQL on shard %', shard;
          RAISE;
      END;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION sharding_do_on_each(text)
  IS 'Runs an SQL statement one each shard. ATTENTION: this may be dangerous, use with care!';
