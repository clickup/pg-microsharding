import chalk from "chalk";
import delay from "delay";
import first from "lodash/first";
import { advanceSequences } from "../internal/advanceSequences";
import { cleanUpPubSub } from "../internal/cleanUpPubSub";
import { copyDDL } from "../internal/copyDDL";
import { log } from "../internal/logging";
import { libSchema, psql } from "../internal/names";
import { resultAbort } from "../internal/resultAbort";
import { resultCommit } from "../internal/resultCommit";
import { runShell } from "../internal/runShell";
import { startCopyingTables } from "../internal/startCopyingTables";
import { waitUntilBackfillCompletes } from "../internal/waitUntilBackfillCompletes";
import { waitUntilIncrementalCompletes } from "../internal/waitUntilIncrementalCompletes";
import { wrapSigInt } from "../internal/wrapSigInt";

/**
 * Moves a shard from one master DB to another.
 */
export async function move({
  shard,
  fromDsn,
  toDsn,
  activateOnDestination,
  deactivateSQL,
}: {
  shard: number;
  fromDsn: string;
  toDsn: string;
  activateOnDestination: boolean;
  deactivateSQL?: string;
}): Promise<void> {
  let unlock = async (): Promise<void> => {};
  try {
    const schema = first(
      await runShell(
        psql(fromDsn),
        `SELECT ${libSchema()}.microsharding_schema_name_(${shard})`,
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
        deactivateSQL,
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
