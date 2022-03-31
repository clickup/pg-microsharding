import chalk from "chalk";
import delay from "delay";
import compact from "lodash/compact";
import first from "lodash/first";
import minimist from "minimist";
import advanceSequences from "./helpers/advanceSequences";
import cleanUpPubSub from "./helpers/cleanUpPubSub";
import copyDDL from "./helpers/copyDDL";
import { log } from "./helpers/logging";
import { libSchema, psql } from "./helpers/names";
import resultAbort from "./helpers/resultAbort";
import resultCommit from "./helpers/resultCommit";
import runShell from "./helpers/runShell";
import startCopyingTables from "./helpers/startCopyingTables";
import waitUntilBackfillCompletes from "./helpers/waitUntilBackfillCompletes";
import waitUntilIncrementalCompletes from "./helpers/waitUntilIncrementalCompletes";
import wrapSigInt from "./helpers/wrapSigInt";

const USAGE = [
  "Usage:",
  "  pg-sharding move\\\n" +
    "    --shard=N --from=DSN --to=DSN \\\n" +
    "    [--activate-on-destination] \\\n" +
    "    [--deactivate-script='SQL $1 SQL']",
];

export async function main(argv: string[]): Promise<boolean> {
  const args = minimist(argv, {
    string: ["shard", "from", "to", "deactivate-script"],
    boolean: ["activate-on-destination"],
  });

  if (args._[0] === "move") {
    let shard: number;
    if ((args.shard ?? "").match(/^(\d+)$/)) {
      shard = parseInt(args.shard);
    } else {
      throw "Please provide --shard, a numeric shard number to move";
    }

    let fromDsn: string;
    if ((args.from ?? "").match(/^\w+:\/\//)) {
      fromDsn = args.from;
    } else {
      throw "Please provide --from, source DB DSN, as postgresql://user:pass@host/db?options";
    }

    let toDsn: string;
    if ((args.to ?? "").match(/^\w+:\/\//)) {
      toDsn = args.to;
    } else {
      throw "Please provide --to, destination DB DSN, as postgresql://user:pass@host/db?options";
    }

    const activateOnDestination = !!args["activate-on-destination"];
    const deactivateScript = args["deactivate-script"] as string | undefined;

    await move({
      shard,
      fromDsn,
      toDsn,
      activateOnDestination,
      deactivateScript,
    });
    return true;
  }

  log(USAGE.join("\n"));
  return false;
}

async function move({
  shard,
  fromDsn,
  toDsn,
  activateOnDestination,
  deactivateScript,
}: {
  shard: number;
  fromDsn: string;
  toDsn: string;
  activateOnDestination: boolean;
  deactivateScript?: string;
}): Promise<void> {
  process.env.PGOPTIONS = compact([
    "--client-min-messages=warning",
    process.env.PGOPTIONS,
  ]).join(" ");

  const schema = first(
    await runShell(
      psql(fromDsn),
      `SELECT ${libSchema()}._sharding_schema_name(${shard})`
    )
  );
  if (!schema) {
    throw `Can't determine schema name for shard number ${shard}`;
  }

  try {
    await cleanUpPubSub({ fromDsn, toDsn, schema, quiet: true });
    await copyDDL({ fromDsn, toDsn, schema });
  } catch (e: any) {
    // no cleanup if failed here since it's one transaction
    log(chalk.red("" + e));
    throw "Exited abnormally with no-op.";
  }

  try {
    await wrapSigInt(async (throwIfAborted) => {
      await startCopyingTables({ fromDsn, toDsn, schema });
      throwIfAborted();
      await waitUntilBackfillCompletes(
        { fromDsn, toDsn, schema },
        throwIfAborted
      );
      await waitUntilIncrementalCompletes(
        { fromDsn, toDsn, schema },
        throwIfAborted
      );
      await advanceSequences({ fromDsn, toDsn });
      throwIfAborted();
    });
  } catch (e) {
    log(chalk.red("" + e));
    log("");
    log("Cleaning up...");
    await delay(1000);
    await resultAbort({ fromDsn, toDsn, schema });
    throw "Exited abnormally";
  }

  try {
    await resultCommit({
      activateOnDestination,
      deactivateScript,
      fromDsn,
      toDsn,
      schema,
    });
  } catch (e) {
    log(chalk.red("" + e));
    log("");
    throw "DANGER! Exited abnormally while committing the result! Shard is in half-working state.";
  }
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((success) => process.exit(success ? 0 : 1))
    .catch((e) => {
      log(chalk.red("" + e));
      process.exit(1);
    });
}
