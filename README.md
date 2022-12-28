# pg-sharding: micro-shards support for PostgreSQL

Each micro-shard is a PG schema with numeric suffix. Micro-shards have the same
set of tables with same names; it's up to the higher-level tools to keep the
schemas of all those tables in sync (e.g. see pg-mig tool).

Micro-shards can be moved from one PG master to another. There is no need to
stop writes while moving micro-shards: the tool uses PG logical replication to
stream each micro-shard table's data, and in the very end, acquires a quick
exclusive lock to finalize the move.

     pg-sharding move
       --shard=N --from=DSN --to=DSN
       [--activate-on-destination]
       [--deactivate-script='SQL $1 SQL']

Each micro-shard can either be "active" or "inactive".

The library exposes low-level API for other higher-level tools as PG functions:

- `sharding_list_active_shards()`: returns the list of "active" shards
- `sharding_ensure_exist()`: allocates a new range micro-shard
- `sharding_ensure_active()`: activates a range of micro-shards
- `sharding_ensure_inactive()`: deactivates a range of micro-shards
- `sharding_ensure_absent()`: drops a range of micro-shards
- `sharding_do_on_each()`: a helper function to run an SQL query on all shards
- `sharding_debug_fdw_create()`: creates "debug foreign shards schemas" for each host in the list.
- `sharding_debug_fds_drop()`: drops all debug foreign shards schemas previously created.
- `sharding_debug_views_create()`: creates "debug views" for tables in all
  micro-shards which unions SELECTs from the same-named tables in all shards
  (not used in production, only for debugging purposes)
- `sharding_debug_views_drop()`: drops all of the debug views
