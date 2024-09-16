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
  $$ SELECT array_agg(s) FROM microsharding_ensure_exist(10, 11) s $$,
  '{test_microsharding0010,test_microsharding0011}',
  'after having 4 shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(nspname ORDER BY nspname) FROM pg_namespace WHERE nspname ~ 'test_microsharding\d+' $$,
  '{test_microsharding0000,test_microsharding0001,test_microsharding0010,test_microsharding0011}',
  'after having 4 shards'
) \gset

SELECT expect(
  $$ SELECT microsharding_list_active_shards() $$,
  '{}',
  'after creating inactive shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM microsharding_ensure_active(0, 1) s $$,
  '{test_microsharding0000,test_microsharding0001}',
  'after activating 2 shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM microsharding_ensure_active(10, 11) s $$,
  '{test_microsharding0010,test_microsharding0011}',
  'after activating 2 more shards'
) \gset

SELECT expect(
  $$ SELECT microsharding_list_active_shards() $$,
  '{test_microsharding0000,test_microsharding0001,test_microsharding0010,test_microsharding0011}',
  'after activating 4 total shards'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM microsharding_ensure_absent(11, 1000) s $$,
  '{test_microsharding0011}',
  'after having 3 shards'
) \gset

SELECT expect(
  $$ SELECT ROW(microsharding_list_active_shards(), microsharding_active_shards_()) $$,
  '("{test_microsharding0000,test_microsharding0001,test_microsharding0010}","{test_microsharding0000,test_microsharding0001,test_microsharding0010}")',
  'after deleting 1 shard'
) \gset

SELECT expect(
  $$ SELECT array_agg(s) FROM microsharding_ensure_inactive(1, 1) s $$,
  '{test_microsharding0001}',
  'after deactivating 1 more shard'
) \gset

SELECT expect(
  $$ SELECT ROW(microsharding_list_active_shards(), microsharding_active_shards_()) $$,
  '("{test_microsharding0000,test_microsharding0010}","{test_microsharding0000,test_microsharding0010}")',
  'after deactivating 1 more shard'
) \gset

SELECT expect(
  $$ SELECT ROW(microsharding_ensure_inactive(0, 0), microsharding_ensure_inactive(10, 10)) $$,
  '(test_microsharding0000,test_microsharding0010)',
  'after deactivating 1 more shard'
) \gset


\dn test_microsharding*

\ir ./rollback.sql
