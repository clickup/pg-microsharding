import first from "lodash/first";
import { psql } from "./names";
import runShell from "./runShell";

/**
 * Returns an estimate for the number of rows in the table.
 */
export default async function getRowCount({
  dsn,
  schema,
  table,
}: {
  dsn: string;
  schema: string;
  table: string;
}): Promise<number> {
  const firstLine = first(
    await runShell(psql(dsn), `EXPLAIN SELECT 1 FROM ${schema}.${table}`),
  );
  return firstLine?.match(/rows=(\d+)/) ? parseInt(RegExp.$1) : 0;
}
