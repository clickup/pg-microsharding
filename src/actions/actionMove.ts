import chalk from "chalk";
import type { ParsedArgs } from "minimist";
import { move } from "../api/move";
import { isTrueValue } from "../internal/isTrueValue";
import { print } from "../internal/logging";
import { normalizeDsn } from "../internal/normalizeDsn";

/**
 * Moves a shard from one database to another with no downtime.
 */
export async function actionMove(args: ParsedArgs): Promise<boolean> {
  let shard: number;
  if (args["shard"]?.match(/^(\d+)$/)) {
    shard = parseInt(args["shard"], 10);
  } else {
    throw "Please provide --shard, a numeric shard number to move";
  }

  const fromDsn = normalizeDsn(args["from"]);
  if (!fromDsn) {
    throw "Please provide --from, source DB DSN, as postgresql://user:pass@host/db?options";
  }

  const toDsn = normalizeDsn(args["to"]);
  if (!toDsn) {
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
