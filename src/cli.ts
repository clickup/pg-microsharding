#!/usr/bin/env node
import chalk from "chalk";
import type { ParsedArgs } from "minimist";
import minimist from "minimist";
import prompts from "prompts";
import { allocate } from "./api/allocate";
import { cleanup } from "./api/cleanup";
import { move } from "./api/move";
import { rebalance } from "./api/rebalance";
import { isTrueValue } from "./internal/isTrueValue";
import { print } from "./internal/logging";
import { normalizeDsn } from "./internal/normalizeDsn";
import { shellQuote } from "./internal/shellQuote";

export { cleanup, allocate, move, rebalance, shellQuote };

const USAGE = [
  "Usage:",
  "  pg-microsharding allocate",
  "    --shard=N | --shards=N-M",
  "    --migrate-cmd='shell command to run migrations'",
  "    --activate={yes | no}",
  "    [--dsn=DSN]",
  "",
  "  pg-microsharding move",
  "    --shard=N",
  "    --from=DSN",
  "    --to=DSN",
  "    --activate-on-destination={yes | no}",
  "    [--deactivate-sql='SQL $1 SQL']",
  "",
  "  pg-microsharding cleanup",
  "    [--dsn=DSN]",
];

/**
 * CLI script entry point.
 */
export async function main(argv: string[]): Promise<boolean> {
  const args = minimist(argv, {
    string: [
      "lib-schema",
      "shard",
      "shards",
      "from",
      "to",
      "deactivate-sql",
      "dsn",
      "activate",
      "activate-on-destination",
    ],
  });

  if (args._[0] === "allocate") {
    return actionAllocate(args);
  }

  if (args._[0] === "move") {
    return actionMove(args);
  }

  if (args._[0] === "cleanup") {
    return actionCleanup(args);
  }

  print(USAGE.join("\n"));
  return false;
}

/**
 * Ensures that some shards exist.
 */
async function actionAllocate(args: ParsedArgs): Promise<boolean> {
  const dsn = normalizeDsn(args["dsn"] || "postgresql://");

  let from: number;
  let to: number;
  if ((args["shard"] || args["shards"])?.match(/^(\d+)(?:-(\d+))?$/)) {
    from = parseInt(RegExp.$1, 10);
    to = parseInt(RegExp.$2 || String(from), 10);
  } else {
    throw "Please provide --shard=N or --shards=N-M, starting and ending shard numbers";
  }

  let migrateCmd: string;
  if (args["migrate-cmd"]) {
    migrateCmd = args["migrate-cmd"];
  } else {
    throw "Please provide --migrate-cmd, shell command to run migrations in between shards creation and activation";
  }

  const activate = isTrueValue(args["activate"] ?? "");
  if (activate === undefined) {
    throw "Please provide --activate=yes or --activate=no";
  }

  await allocate({ dsn, from, to, migrateCmd, activate });

  return true;
}

/**
 * Moves a shard from one database to another with no downtime.
 */
async function actionMove(args: ParsedArgs): Promise<boolean> {
  let shard: number;
  if (args["shard"]?.match(/^(\d+)$/)) {
    shard = parseInt(args["shard"], 10);
  } else {
    throw "Please provide --shard, a numeric shard number to move";
  }

  let fromDsn: string;
  if (args["from"]) {
    fromDsn = normalizeDsn(args["from"]);
  } else {
    throw "Please provide --from, source DB DSN, as postgresql://user:pass@host/db?options";
  }

  let toDsn: string;
  if (args["to"]) {
    toDsn = normalizeDsn(args["to"]);
  } else {
    throw "Please provide --to, destination DB DSN, as postgresql://user:pass@host/db?options";
  }

  const activateOnDestination = isTrueValue(args["activate-on-destination"]);
  if (activateOnDestination === undefined) {
    throw "Please provide --activate-on-destination=yes or --activate-on-destination=no";
  }

  const deactivateSQL = String(args["deactivate-sql"] || "") || undefined;

  await move({
    shard,
    fromDsn,
    toDsn,
    activateOnDestination,
    deactivateSQL,
  });

  if (!activateOnDestination) {
    print(
      "\n" +
        chalk.yellow(
          "ATTENTION: the schema has been copied, but NOT activated on the destination. " +
            "So effectively, it was a dry-run, and the data still lives in the source DB. " +
            "To activate the schema on the destination and deactivate on the source, run " +
            "the tool with --activate-on-destination=yes option.",
        ),
    );
  }

  return true;
}

/**
 * Removes previously moved schema originals from the source database.
 */
async function actionCleanup(args: ParsedArgs): Promise<boolean> {
  let dsn: string;
  if (args["dsn"]) {
    dsn = normalizeDsn(args["dsn"]);
  } else {
    throw "Please provide --dsn, DB DSN to remove old schemas from, as postgresql://user:pass@host/db?options";
  }

  await cleanup({
    dsn,
    noOldShards: async (oldSchemaNameRe) =>
      print(`No old shard schemas matching regexp ${oldSchemaNameRe}`),
    confirm: async (schemas) => {
      const response = await prompts({
        type: "text",
        name: "value",
        message: `Delete redundant schemas ${schemas.join(", ")} (y/n)?`,
        validate: (value: string) =>
          value !== "y" && value !== "n" ? 'Enter "y" or "n".' : true,
      });
      return response.value === "y";
    },
  });

  return true;
}

/**
 * Run CLI entry point if called in the command line.
 */
if (require.main === module) {
  main(process.argv.slice(2))
    .then((success) => process.exit(success ? 0 : 1))
    .catch((e) => {
      print(chalk.red("" + e));
      process.exit(1);
    });
}
