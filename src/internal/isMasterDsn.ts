import { psql } from "./names";
import { runShell } from "./runShell";

/**
 * Checks whether the given DSN is a master database.
 */
export async function isMasterDsn(dsn: string): Promise<boolean> {
  const result = await runShell(psql(dsn), "SELECT pg_is_in_recovery()");
  return result[0] === "f";
}
