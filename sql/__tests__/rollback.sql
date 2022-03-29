\ir ../pg-sharding-down.sql

SET search_path TO test_sharding;

DROP FUNCTION expect(text, text, text);

SET search_path TO public;
DROP SCHEMA test_sharding;

ROLLBACK;
