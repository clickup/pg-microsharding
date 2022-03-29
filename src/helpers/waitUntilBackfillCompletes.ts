import chalk from "chalk";
import delay from "delay";
import getRowCount from "./getRowCount";
import { log, progress } from "./logging";
import { psql, subName } from "./names";
import runShell from "./runShell";

/**
 * Waits until backfill of the destination tables finishes.
 */
export default async function waitUntilBackfillCompletes(
  {
    fromDsn,
    toDsn,
    schema,
  }: {
    fromDsn: string;
    toDsn: string;
    schema: string;
  },
  throwIfAborted: () => void
): Promise<void> {
  while (true) {
    const backfillingTables = await runShell(
      psql(toDsn),
      `SELECT relname FROM pg_stat_subscription JOIN pg_class ON pg_class.oid=relid ` +
        `WHERE subname='${subName(schema)}' AND relid IS NOT NULL`
    );
    if (backfillingTables.length === 0) {
      break;
    }

    const stats: string[] = [];
    for (const table of backfillingTables) {
      const countFrom = await getRowCount({
        dsn: fromDsn,
        schema,
        table,
      });
      const countTo = Math.min(
        countFrom,
        await getRowCount({
          dsn: toDsn,
          schema,
          table,
        })
      );
      const percent =
        countFrom === 0
          ? "100"
          : Math.min(100, Math.round((countTo / countFrom) * 100));
      stats.push(`${table} (${percent}%, ${countTo} of ${countFrom})`);
      throwIfAborted();
    }

    progress(`...still backfilling: ${stats.join(", ")}`);
    await delay(1000);
    throwIfAborted();
  }

  log(chalk.whiteBright("Backfill completed!"));
}
