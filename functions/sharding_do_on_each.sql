CREATE OR REPLACE FUNCTION sharding_do_on_each(cmd text, OUT shard text, out row_count text) RETURNS SETOF record
LANGUAGE plpgsql
AS $$
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
