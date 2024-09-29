#!/usr/bin/env node
import { existsSync } from "fs";
import { dirname } from "path";
import chalk from "chalk";
import minimist from "minimist";
import { actionAllocate } from "./actions/actionAllocate";
import { actionCleanup } from "./actions/actionCleanup";
import { actionList } from "./actions/actionList";
import { actionMove } from "./actions/actionMove";
import { actionRebalance } from "./actions/actionRebalance";
import { allocate } from "./api/allocate";
import { cleanup } from "./api/cleanup";
import { move } from "./api/move";
import { rebalance } from "./api/rebalance";
import { print } from "./internal/logging";
import { shellQuote } from "./internal/shellQuote";
import { unindent } from "./internal/unindent";

export { allocate, cleanup, move, rebalance, shellQuote };

const USAGE = unindent(`
  USAGE

    pg-microsharding list | ls
      [--weight-sql='SELECT returning weight with optional unit']
      [--dsn=DSN | --dsns=DNS1,DSN2,...]

    pg-microsharding allocate
      --shard=N | --shards=N-M
      --migrate-cmd='shell command to run migrations'
      --activate={yes | no}
      [--dsn=DSN | --dsns=DNS1,DSN2,...]

    pg-microsharding move
      --shard=N
      --from=DSN
      --to=DSN
      --activate-on-destination={yes | no}
      [--deactivate-sql='SQL $1 SQL']

    pg-microsharding rebalance
      --activate-on-destination={yes | no}
      [--deactivate-sql='SQL $1 SQL']
      [--weight-sql='SELECT returning weight with optional unit']
      [--decommission=DSN1,DSN2,...]
      [--parallelism=N]
      [--dsn=DSN | --dsns=DNS1,DSN2,...]

    pg-microsharding cleanup
      [--dsn=DSN | --dsns=DNS1,DSN2,...]

  ENVIRONMENT VARIABLES

    The tool receives parameters from command line option, but allows to set
    defaults for most of them using environment variables.

    Some variables are standard for psql command:

    - PGUSER: default database user
    - PGPASSWORD: default database password
    - PGHOST: default database host
    - PGPORT: default database port
    - PGDATABASE: default database name
    - PGSSLMODE: default SSL mode (e.g. "prefer")

    Custom variables:

    - DSNS or PGDSNS: default value for --dsns option, comma-separated list
      of DSNs (see below)
    - MIGRATE_CMD: default value for --migrate-cmd option
    - WEIGHT_SQL: default value for --weight-sql option
    - DEACTIVATE_SQL: default value for --deactivate-sql option

  DSN AND ADDRESSING DATABASES

    Option --dsns, if required, should be a comma separated list of DSNs.
    Also, you may pass duplicated DSNs and even DSNs of replicas: the tool
    will filter them out and remain only master DSNs in the list.

    DSN format examples (parts defaults are from environment variables):

    - postgresql://user:pass@hostname/db?options (all parts are optional)
    - hostname:port/db (all parts except hostname are optional)

    The tool also tries to find pg-microsharding.config.js file in the current
    and parent directories and, if found, treats its exports as environment
    variables, merging them into process.env.
`);

const ACTIONS = {
  allocate: actionAllocate,
  cleanup: actionCleanup,
  list: actionList,
  ls: actionList,
  move: actionMove,
  rebalance: actionRebalance,
};

export async function main(argv: string[]): Promise<boolean> {
  const configs: object[] = [];
  for (let dir = process.cwd(); dirname(dir) !== dir; dir = dirname(dir)) {
    const path = `${dir}/pg-microsharding.config.js`;
    if (existsSync(path)) {
      const loaded = require(path);
      configs.push(
        loaded instanceof Function
          ? loaded()
          : loaded.default instanceof Function
            ? loaded.default()
            : loaded.default
              ? loaded.default
              : loaded,
      );
    }
  }

  for (const config of configs.reverse()) {
    Object.assign(process.env, config);
  }

  const args = minimist(argv, {
    string: [
      "lib-schema",
      "shard",
      "shards",
      "from",
      "to",
      "deactivate-sql",
      "dsn",
      "dsns",
      "activate",
      "activate-on-destination",
      "weight-sql",
    ],
  });

  const DSNS = process.env["PGDSNS"] || process.env["DSNS"];
  if (!args["dsns"] && !args["dsn"] && DSNS) {
    args["dsns"] = DSNS;
  }

  const MIGRATE_CMD = process.env["MIGRATE_CMD"];
  if (!args["migrate-cmd"] && MIGRATE_CMD) {
    args["migrate-cmd"] = MIGRATE_CMD;
  }

  const WEIGHT_SQL = process.env["WEIGHT_SQL"];
  if (!args["weight-sql"] && WEIGHT_SQL) {
    args["weight-sql"] = WEIGHT_SQL;
  }

  const DEACTIVATE_SQL = process.env["DEACTIVATE_SQL"];
  if (!args["deactivate-sql"] && DEACTIVATE_SQL) {
    args["deactivate-sql"] = DEACTIVATE_SQL;
  }

  const action = args._[0] as keyof typeof ACTIONS;
  if (!action) {
    // eslint-disable-next-line no-console
    console.log(USAGE);
    return true;
  }

  if (action in ACTIONS) {
    return ACTIONS[action](args);
  }

  throw `Unknown action: ${action}`;
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((success) => process.exit(success ? 0 : 1))
    .catch((e) => {
      print(chalk.red("" + e));
      process.exit(1);
    });
}
