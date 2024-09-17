import { libSchema, psql } from "../internal/names";
import { runShell } from "../internal/runShell";

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
