import { libSchema, psql } from "./names";
import { runShell } from "./runShell";

/**
 * Returns the list of active shards on a DSN.
 */
export async function listActiveSchemas({
  dsn,
}: {
  dsn: string;
}): Promise<string[]> {
  return runShell(
    psql(dsn),
    `SELECT unnest FROM unnest(${libSchema()}.microsharding_list_active_shards())`,
  );
}
