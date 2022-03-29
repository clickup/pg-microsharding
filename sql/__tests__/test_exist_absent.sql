\ir ./begin.sql

SELECT expect(
  $$ SELECT sharding_list_active_shards() $$,
  '{}',
  'before creating any shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_ensure_exist(0, 1) s $$,
  '{shtest0000,shtest0001}',
  'after having 2 shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_ensure_exist(10, 11) s $$,
  '{shtest0010,shtest0011}',
  'after having 4 shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(nspname ORDER BY nspname) FROM pg_namespace WHERE nspname LIKE 'shtest%' $$,
  '{shtest0000,shtest0001,shtest0010,shtest0011}',
  'after having 4 shards'
) \gset

SELECT expect(
  $$ SELECT sharding_list_active_shards() $$,
  '{}',
  'after creating inactive shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_ensure_active(0, 1) s $$,
  '{shtest0000,shtest0001}',
  'after activating 2 shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_ensure_active(10, 11) s $$,
  '{shtest0010,shtest0011}',
  'after activating 5 shards'
) \gset

SELECT expect(
  $$ SELECT sharding_list_active_shards() $$,
  '{shtest0000,shtest0001,shtest0010,shtest0011}',
  'after activating 2 shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_ensure_absent(11, 1000) s $$,
  '{shtest0011}',
  'after having 3 shards'
) \gset

SELECT expect(
  $$ SELECT ROW(sharding_list_active_shards(), _sharding_active_shards()) $$,
  '("{shtest0000,shtest0001,shtest0010}","{shtest0000,shtest0001,shtest0010}")',
  'after deleting 1 shard'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM sharding_ensure_inactive(1, 1) s $$,
  '{shtest0001}',
  'after deactivating 1 more shard'
) \gset

SELECT expect(
  $$ SELECT ROW(sharding_list_active_shards(), _sharding_active_shards()) $$,
  '("{shtest0000,shtest0010}","{shtest0000,shtest0010}")',
  'after deactivating 1 more shard'
) \gset

SELECT expect(
  $$ SELECT ROW(sharding_ensure_inactive(0, 0), sharding_ensure_inactive(10, 10)) $$,
  '(shtest0000,shtest0010)',
  'after deactivating 1 more shard'
) \gset


\dn shtest*

\ir ./rollback.sql
