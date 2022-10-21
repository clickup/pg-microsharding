import { dsnToHost, pgDump, psql } from "./names";
import runShell from "./runShell";

/**
 * Copies DDL of the schema.
 */
export default async function copyDDL({
  fromDsn,
  toDsn,
  schema,
}: {
  fromDsn: string;
  toDsn: string;
  schema: string;
}): Promise<void> {
  await runShell(
    `${pgDump(fromDsn)} -n ${schema} | ${psql(toDsn)} --single-transaction`,
    null,
    `Copying DDL for ${schema} ` +
      `from ${dsnToHost(fromDsn)} to ${dsnToHost(toDsn)}...`
  );
}
