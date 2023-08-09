import chalk from "chalk";
import delay from "delay";
import getRowCount from "./getRowCount";
import { log, progress } from "./logging";
import { psql, subName } from "./names";
import runShell from "./runShell";

const STATES: Record<string, string | unknown> = {
  i: "initializing",
  d: "data is being copied",
  f: "finished table copy",
  s: "synchronized",
  r: "ready",
};

/**
 * Waits until backfill of the destination tables finishes.
 * https://www.postgresql.org/docs/14/catalog-pg-subscription-rel.html
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
    const backfillingTables = (
      await runShell(
        psql(toDsn),
        "SELECT relname, srsubstate " +
          "FROM pg_subscription_rel " +
          "JOIN pg_subscription ON pg_subscription.oid=srsubid " +
          "JOIN pg_class ON pg_class.oid=srrelid " +
          `WHERE subname='${subName(schema)}' AND srsubstate<>'r'`
      )
    ).map((s) => s.split("|") as [string, string]);
    if (backfillingTables.length === 0) {
      progress.clear();
      break;
    }

    const stats: string[] = [];
    for (const [table, state] of backfillingTables) {
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
      const stateName = STATES[state] ?? state;
      stats.push(
        `${table} (${stateName}: ${percent}%, ${countTo} of ${countFrom})`
      );
      throwIfAborted();
    }

    progress("...still backfilling:\n" + stats.map((s) => `- ${s}`).join("\n"));
    await delay(1000);
    throwIfAborted();
  }

  log(chalk.whiteBright("Backfill completed!"));
}
