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
  $$ SELECT array_agg(s) FROM sharding_ensure_exist(10, 11) s $$,
  '{test_sharding0010,test_sharding0011}',
  'after having 4 shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(nspname ORDER BY nspname) FROM pg_namespace WHERE nspname ~ 'test_sharding\d+' $$,
  '{test_sharding0000,test_sharding0001,test_sharding0010,test_sharding0011}',
  'after having 4 shards'
) \gset

SELECT expect(
  $$ SELECT sharding_list_active_shards() $$,
  '{}',
  'after creating inactive shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_ensure_active(0, 1) s $$,
  '{test_sharding0000,test_sharding0001}',
  'after activating 2 shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_ensure_active(10, 11) s $$,
  '{test_sharding0010,test_sharding0011}',
  'after activating 5 shards'
) \gset

SELECT expect(
  $$ SELECT sharding_list_active_shards() $$,
  '{test_sharding0000,test_sharding0001,test_sharding0010,test_sharding0011}',
  'after activating 2 shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_ensure_absent(11, 1000) s $$,
  '{test_sharding0011}',
  'after having 3 shards'
) \gset

SELECT expect(
  $$ SELECT ROW(sharding_list_active_shards(), _sharding_active_shards()) $$,
  '("{test_sharding0000,test_sharding0001,test_sharding0010}","{test_sharding0000,test_sharding0001,test_sharding0010}")',
  'after deleting 1 shard'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_ensure_inactive(1, 1) s $$,
  '{test_sharding0001}',
  'after deactivating 1 more shard'
) \gset

SELECT expect(
  $$ SELECT ROW(sharding_list_active_shards(), _sharding_active_shards()) $$,
  '("{test_sharding0000,test_sharding0010}","{test_sharding0000,test_sharding0010}")',
  'after deactivating 1 more shard'
) \gset

SELECT expect(
  $$ SELECT ROW(sharding_ensure_inactive(0, 0), sharding_ensure_inactive(10, 10)) $$,
  '(test_sharding0000,test_sharding0010)',
  'after deactivating 1 more shard'
) \gset


\dn test_sharding*

\ir ./rollback.sql
