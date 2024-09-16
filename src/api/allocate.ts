import { spawnSync } from "child_process";
import { log } from "../internal/logging";
import { libSchema, psql } from "../internal/names";
import { runShell } from "../internal/runShell";

/**
 * Ensures that all shards in the range exist on the DSN, then runs a shell
 * script (presumably DB migration), and then optionally activates the shards.
 */
export async function allocate({
  dsn,
  from,
  to,
  migrateCmd,
  activate,
}: {
  dsn: string;
  from: number;
  to: number;
  migrateCmd: string;
  activate: boolean;
}): Promise<void> {
  await runShell(
    psql(dsn),
    `SELECT ${libSchema()}.microsharding_ensure_exist(${from}, ${to})`,
    `Ensuring that all shards in the range ${from}-${to} exist...`,
  );

  log(
    `Running DB migration shell command "${migrateCmd}".` +
      (activate ? " (Shards will only be activated if it succeeds.)" : ""),
  );
  const { status } = spawnSync(migrateCmd, { stdio: "inherit" });
  if (status !== 0) {
    throw "Error detected. NEW SHARDS WERE NOT ACTIVATED!";
  }

  if (activate) {
    await runShell(
      psql(dsn),
      `SELECT ${libSchema()}.microsharding_ensure_active(${from}, ${to})`,
      `Ensuring that all shards in the range ${from}-${to} are active...`,
    );
  }
}
