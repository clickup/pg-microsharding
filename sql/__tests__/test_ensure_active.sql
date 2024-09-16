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
  $$
    SELECT array_agg(s) FROM microsharding_ensure_active(0) s;
    SELECT array_agg(s) FROM microsharding_ensure_active(1) s;
    SELECT microsharding_list_active_shards();
  $$,
  '{test_microsharding0000,test_microsharding0001}',
  'after activating 2 shards'
) \gset

\dn test_microsharding*

\ir ./rollback.sql
