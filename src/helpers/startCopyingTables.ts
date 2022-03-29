import getTablesInSchema from "./getTablesInSchema";
import { psql, pubName, subName } from "./names";
import runShell from "./runShell";

/**
 * Copies DDL and creates publication/subscription which starts copying the
 * data. The data continues copying in background.
 */
export default async function startCopyingTables({
  fromDsn,
  toDsn,
  schema,
}: {
  fromDsn: string;
  toDsn: string;
  schema: string;
}): Promise<string[]> {
  const tables = await getTablesInSchema({ fromDsn, schema });
  await runShell(
    psql(fromDsn),
    [
      `SET search_path TO ${schema}`,
      `CREATE PUBLICATION ${pubName(schema)} FOR TABLE ${tables.join(",")}`,
    ].join("; "),
    "Creating source publication"
  );
  // We create the replication slot separately only to be able to test the tool
  // on dev: without a replication slot, when using the same database as a
  // source and destination, CREATE SUBSCRIPTION operation hangs (weird
  // documented behavior).
  await runShell(
    psql(fromDsn),
    `SELECT pg_create_logical_replication_slot('${subName(schema)}','pgoutput')`
  );
  await runShell(
    psql(toDsn),
    `CREATE SUBSCRIPTION ${subName(schema)} ` +
      `CONNECTION '${fromDsn}' ` +
      `PUBLICATION ${pubName(schema)} ` +
      `WITH (create_slot=false)`,
    "Creating destination subscription"
  );
  return tables;
}
