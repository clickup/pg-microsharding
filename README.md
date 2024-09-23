# @clickup/pg-microsharding: microshards support for PostgreSQL

See also [TS API documentation](https://github.com/clickup/pg-microsharding/blob/master/docs/modules.md).

![CI run](https://github.com/clickup/pg-microsharding/actions/workflows/ci.yml/badge.svg?branch=main)

Each microshard is a PG schema with numeric suffix. Microshards have the same
set of tables with same names; it's up to the higher-level tools to keep the
schemas of all those tables in sync (e.g. see pg-mig tool).

Microshards can be moved from one PG master to another. There is no need to stop
writes while moving microshards: the tool uses PG logical replication to stream
each microshard table's data, and in the very end, acquires a quick exclusive
lock to finalize the move.

Each microshard can either be "active" or "inactive".

The library exposes command-line tool `pg-microsharding`. Some (non-exhaustive)
list of commands:

- `pg-microsharding list`
- `pg-microsharding allocate --shards=N-M ...`
- `pg-microsharding move --shard=N --from=DSN --to=DSN ...`
- `pg-microsharding rebalance ...`
- `pg-microsharding cleanup`
- ...
- run the tool to see other commands, options and environment variables.

The tool accepts parameters using the following ways:

1. Via command line arguments, see built-in help.
2. Via environment variables: PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE,
   PGSSLMODE etc. It also recognizes several additional variables, like PGDSNS
   and MIGRATE_CMD.
3. Via `pg-microsharding.config.js` file if it's found in the current folder or
   below. The file should export an object with environment variable names in
   keys and strings in values.

The tool exposes a performant PostgreSQL stored functions API for microshards
discovery (it's supposed to be called from all nodes of the cluster from time to
time):

- `microsharding.microsharding_list_active_shards()`: returns the list of
  "active" shards as an array.

It also provides system administration stored functions API:

- `microsharding_do_on_each()`: a helper function to run an SQL query on all shards
- `microsharding_debug_views_create()`: creates "debug views" for tables in all
  microshards that union SELECTs from the same-named tables in all shards (not
  used in production, only for debugging purposes)
- `microsharding_debug_views_drop()`: drops all of the debug views
- `microsharding_debug_fdw_create()`: creates "debug foreign shards schemas" for
  each host in the list
- `microsharding_debug_fdw_drop()`: drops all debug foreign shards schemas
  previously created

And some lower level APIs:

- `microsharding_ensure_exist()`: allocates a new range of microshards
- `microsharding_ensure_active()`: activates a range of microshards
- `microsharding_ensure_inactive()`: deactivates a range of microshards
- `microsharding_ensure_absent()`: drops a range of microshards
