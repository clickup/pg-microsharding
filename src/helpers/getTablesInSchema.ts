import { psql } from "./names";
import runShell from "./runShell";

export default async function getTablesInSchema({
  fromDsn,
  schema,
}: {
  fromDsn: string;
  schema: string;
}): Promise<string[]> {
  return runShell(
    psql(fromDsn),
    `SELECT table_name FROM information_schema.tables WHERE table_schema='${schema}'`
  );
}
