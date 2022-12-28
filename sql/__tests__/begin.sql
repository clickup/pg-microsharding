\set ON_ERROR_STOP on

-- Remove artifacts of the previous unfuccessful runs (if any).
DO $$
BEGIN
  DROP TABLE IF EXISTS test_sharding0001.tbl1;
  SET search_path TO test_sharding;
  PERFORM sharding_debug_fdw_drop('test_sharding_fdw');
  PERFORM sharding_ensure_absent(0, 1000);
  SET search_path TO public;
  DROP SCHEMA test_sharding CASCADE;
EXCEPTION
  WHEN OTHERS THEN -- skip
END
$$;

BEGIN;

CREATE SCHEMA test_sharding;
SET search_path TO test_sharding;
SET client_min_messages TO NOTICE;
\set ON_ERROR_STOP on

\ir ../pg-sharding-up.sql


CREATE OR REPLACE FUNCTION _sharding_schema_name(
  shard integer
) RETURNS text
LANGUAGE sql
SET search_path FROM CURRENT
AS $$
  SELECT 'test_sharding' || lpad($1::text, 4, '0')
$$;


CREATE FUNCTION expect(sql text, exp text, msg text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  got text;
BEGIN
  EXECUTE sql INTO got;
  IF got IS DISTINCT FROM exp THEN
    RAISE EXCEPTION 'Expectation failed (%): expected %, got %', msg, exp, got;
  END IF;
END;
$$;
