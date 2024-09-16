SET search_path TO test_microsharding;

SELECT array_agg(s) FROM microsharding_ensure_absent(0, 1000) s \gset
SELECT array_agg(s) FROM microsharding_debug_fdw_drop('test_microsharding_fdw') s \gset

\ir ../pg-microsharding-down.sql

DROP FUNCTION expect(text, text, text);

SET search_path TO public;
DROP SCHEMA test_microsharding;

COMMIT;
