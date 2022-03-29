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
  SELECT 'shtest' || lpad($1::text, 4, '0')
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
