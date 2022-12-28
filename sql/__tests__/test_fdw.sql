\ir ./begin.sql

SELECT expect(
  $$ SELECT sharding_list_active_shards() $$,
  '{}',
  'before creating any shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_ensure_exist(0, 1) s $$,
  '{test_sharding0000,test_sharding0001}',
  'after having 2 shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_ensure_active(0, 1) s $$,
  '{test_sharding0000,test_sharding0001}',
  'after activating 2 shards'
) \gset

CREATE TABLE test_sharding0001.tbl1(id bigint);

COMMIT;
BEGIN;
SET search_path TO test_sharding;

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_debug_fdw_create('test_sharding_fdw', '{localhost}') s $$,
  '{"(test_sharding_fdw_localhost,2)"}',
  'after creating foreign views'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_debug_views_create('test_sharding', 'test_sharding_fdw') s $$,
  '{test_sharding.tbl1}',
  'after creating debug views'
) \gset

\dn test_sharding*
\d test_sharding_fdw_test_sharding0001.*

DROP TABLE test_sharding0001.tbl1;

\ir ./rollback.sql
