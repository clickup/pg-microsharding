import chalk from "chalk";
import delay from "delay";
import first from "lodash/first";
import { Client } from "pg";
import getTablesInSchema from "./getTablesInSchema";
import { log, progress } from "./logging";
import { psql } from "./names";
import runShell from "./runShell";

/**
 * Locks the tables for write and waits until incremental flow to the
 * destination tables exhausts.
 */
export default async function waitUntilIncrementalCompletes(
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
  const tables = await getTablesInSchema({ fromDsn, schema });
  if (tables.length === 0) {
    return;
  }

  const client = new Client({
    connectionString: fromDsn.replace(/(?<=[&?])sslmode=prefer&?/, ""),
    ssl: fromDsn.match(/[&?]sslmode=prefer/)
      ? { rejectUnauthorized: false }
      : undefined,
    application_name: "waitUntilIncrementalCompletes",
  });
  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout TO 0");
    await client.query(`SET LOCAL search_path TO ${schema}`);
    throwIfAborted();

    progress("Locking source tables for write...");
    await client.query(`LOCK ${tables.join(", ")} IN EXCLUSIVE MODE`);
    throwIfAborted();

    const tableCounts = new Map<string, number>();
    for (const table of tables) {
      progress(`...getting precise row count for source table ${table}...`);
      const {
        rows: [{ count }],
      } = await client.query<{ count: string }>(
        `SELECT COUNT(1) FROM ${table}`
      );
      tableCounts.set(table, parseInt(count));
      throwIfAborted();
    }

    let prevStats: string[] = [];
    while (true) {
      const stats: string[] = [];
      for (const table of tables) {
        progress(
          `...still replicating ` +
            (prevStats.length > 0 ? prevStats : stats).join(", ") +
            `\n...getting precise row count for destination table ${table}...`
        );
        const countTo = parseInt(
          first(
            await runShell(
              psql(toDsn),
              `SELECT COUNT(1) FROM ${schema}.${table}`
            )
          )!
        );
        const countFrom = tableCounts.get(table);
        if (countFrom !== countTo) {
          stats.push(`${table} (src=${countFrom} dst=${countTo})`);
        }

        throwIfAborted();
      }

      if (stats.length === 0) {
        progress(
          "...count of rows is identical in source and destination tables"
        );
        break;
      }

      prevStats = stats;
      await delay(1000);
      throwIfAborted();
    }
  } catch (e: any) {
    log(chalk.red(e.toString()));
    throw e;
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }

  log(chalk.whiteBright("Incremental replication completed!"));
}
