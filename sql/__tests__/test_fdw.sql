\ir ./begin.sql

SELECT expect(
  $$ SELECT microsharding_list_active_shards() $$,
  '{}',
  'before creating any shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM microsharding_ensure_exist(0, 1) s $$,
  '{test_microsharding0000,test_microsharding0001}',
  'after having 2 shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM microsharding_ensure_active(0, 1) s $$,
  '{test_microsharding0000,test_microsharding0001}',
  'after activating 2 shards'
) \gset

CREATE TABLE test_microsharding0001.tbl1(id bigint);

COMMIT;
BEGIN;
SET search_path TO test_microsharding;

SELECT expect(
  $$ SELECT array_agg(s) FROM microsharding_debug_fdw_create('test_microsharding_fdw', '{localhost}') s $$,
  '{"(test_microsharding_fdw_localhost,2)"}',
  'after creating foreign views'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM microsharding_debug_views_create('test_microsharding', 'test_microsharding_fdw') s $$,
  '{test_microsharding.tbl1}',
  'after creating debug views'
) \gset

\dn test_microsharding*
\d test_microsharding_fdw_test_microsharding0001.*

DROP TABLE test_microsharding0001.tbl1;

\ir ./rollback.sql
