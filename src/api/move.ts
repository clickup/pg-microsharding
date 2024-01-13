import chalk from "chalk";
import delay from "delay";
import first from "lodash/first";
import advanceSequences from "../helpers/advanceSequences";
import cleanUpPubSub from "../helpers/cleanUpPubSub";
import copyDDL from "../helpers/copyDDL";
import { log } from "../helpers/logging";
import { libSchema, psql } from "../helpers/names";
import resultAbort from "../helpers/resultAbort";
import resultCommit from "../helpers/resultCommit";
import runShell from "../helpers/runShell";
import startCopyingTables from "../helpers/startCopyingTables";
import waitUntilBackfillCompletes from "../helpers/waitUntilBackfillCompletes";
import waitUntilIncrementalCompletes from "../helpers/waitUntilIncrementalCompletes";
import wrapSigInt from "../helpers/wrapSigInt";

/**
 * Moves a shard from one master DB to another.
 */
export default async function move({
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
  let unlock = async (): Promise<void> => {};
  try {
    const schema = first(
      await runShell(
        psql(fromDsn),
        `SELECT ${libSchema()}._sharding_schema_name(${shard})`,
      ),
    );
    if (!schema) {
      throw `Can't determine schema name for shard number ${shard}`;
    }

    try {
      await cleanUpPubSub({ fromDsn, toDsn, schema, quiet: true });
      await copyDDL({ fromDsn, toDsn, schema });
    } catch (e: unknown) {
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
          throwIfAborted,
        );
        unlock = await waitUntilIncrementalCompletes(
          { fromDsn, schema },
          throwIfAborted,
        );
        await advanceSequences({ fromDsn, toDsn });
      });
    } catch (e: unknown) {
      log(chalk.red("" + e));
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
    } catch (e: unknown) {
      log(chalk.red("" + e));
      throw "DANGER! Exited abnormally while committing the result! Shard is in half-working state.";
    }
  } finally {
    await unlock();
  }
}
