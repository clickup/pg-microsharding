SET search_path TO test_sharding;

SELECT array_agg(s) FROM sharding_ensure_absent(0, 1000) s \gset
SELECT array_agg(s) FROM sharding_debug_fdw_drop('test_sharding_fdw') s \gset

\ir ../pg-sharding-down.sql

DROP FUNCTION expect(text, text, text);

SET search_path TO public;
DROP SCHEMA test_sharding;

COMMIT;

