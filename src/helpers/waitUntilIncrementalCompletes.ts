import chalk from "chalk";
import delay from "delay";
import { Client } from "pg";
import getTablesInSchema from "./getTablesInSchema";
import { log, progress } from "./logging";
import { subName } from "./names";

/**
 * Locks the tables for write and waits until incremental flow to the
 * destination tables exhausts.
 *
 * If succeeded, the function returns a callback which, when called, unlocks the
 * tables on the source. This callback must be called after deactivating the
 * shard on the source. (But even if it's not called, it'll likely be okay
 * still, because the process will end, PG will disconnect, and the tables will
 * be auto-unlocked.)
 */
export default async function waitUntilIncrementalCompletes(
  {
    fromDsn,
    schema,
  }: {
    fromDsn: string;
    schema: string;
  },
  throwIfAborted: () => void
): Promise<() => Promise<void>> {
  const tables = await getTablesInSchema({ fromDsn, schema });
  if (tables.length === 0) {
    log("No tables found");
    return async () => {};
  }

  const fromClient = new Client({
    connectionString: fromDsn.replace(/(?<=[&?])sslmode=prefer&?/, ""),
    ssl: fromDsn.match(/[&?]sslmode=prefer/)
      ? { rejectUnauthorized: false }
      : undefined,
    application_name: "waitUntilIncrementalCompletes",
  });

  try {
    await fromClient.connect();
    await fromClient.query("BEGIN");
    await fromClient.query("SET LOCAL statement_timeout TO 0");
    await fromClient.query(`SET LOCAL search_path TO ${schema}`);
    throwIfAborted();

    log(chalk.greenBright("Locking source tables for WRITE by anyone..."));
    const query = `LOCK ${tables.join(", ")} IN EXCLUSIVE MODE`;
    log(chalk.gray(`$ node-postgres ${fromDsn}\n${query}`));
    await fromClient.query(query);
    throwIfAborted();

    const { lsn: fromLsn } = (
      await fromClient.query<{ lsn: string }>(
        "SELECT pg_current_wal_insert_lsn() AS lsn"
      )
    ).rows[0];

    while (true) {
      const { lsn: confirmedLsn, gap } = (
        await fromClient.query<{ lsn: string; gap: string | number }>(
          `SELECT
             confirmed_flush_lsn AS lsn,
             GREATEST($2 - confirmed_flush_lsn, 0) AS gap
           FROM pg_replication_slots
           WHERE slot_name=$1`,
          [subName(schema), fromLsn]
        )
      ).rows[0];
      progress(
        `...waiting for the destination LSN (${confirmedLsn}) >= source LSN (${fromLsn}); gap: ${gap}`
      );
      if (gap.toString() === "0") {
        break;
      }

      await delay(1000);
      throwIfAborted();
    }
  } catch (e: unknown) {
    await fromClient.query("ROLLBACK");
    await fromClient.end();
    throw e;
  }

  log(chalk.whiteBright("Incremental replication completed!"));

  return async () => {
    log(chalk.greenBright("Unlocking source tables"));
    const query = "ROLLBACK";
    log(chalk.gray(`$ node-postgres ${fromDsn}\n${query}`));
    await fromClient.query(query);
    await fromClient.end();
  };
}
