\set ON_ERROR_STOP on

-- Remove artifacts of the previous unfuccessful runs (if any).
DO $$
BEGIN
  DROP TABLE IF EXISTS test_microsharding0001.tbl1;
  SET search_path TO test_microsharding;
  PERFORM microsharding_debug_fdw_drop('test_microsharding_fdw');
  PERFORM microsharding_ensure_absent(0, 1000);
  SET search_path TO public;
  DROP SCHEMA test_microsharding CASCADE;
EXCEPTION
  WHEN OTHERS THEN -- skip
END
$$;

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgres_fdw;
CREATE EXTENSION IF NOT EXISTS dblink;

CREATE SCHEMA test_microsharding;
SET search_path TO test_microsharding;
SET client_min_messages TO NOTICE;
\set ON_ERROR_STOP on

\ir ../pg-microsharding-up.sql


CREATE OR REPLACE FUNCTION microsharding_schema_name_(
  shard integer
) RETURNS text
LANGUAGE sql
SET search_path FROM CURRENT
AS $$
  SELECT 'test_microsharding' || lpad($1::text, 4, '0')
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
