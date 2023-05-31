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
  $$
    SELECT array_agg(s) FROM sharding_ensure_active(0) s;
    SELECT array_agg(s) FROM sharding_ensure_active(1) s;
    SELECT sharding_list_active_shards();
  $$,
  '{test_sharding0000,test_sharding0001}',
  'after activating 2 shards'
) \gset

\dn test_sharding*

\ir ./rollback.sql
