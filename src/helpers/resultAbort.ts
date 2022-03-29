import cleanUpPubSub from "./cleanUpPubSub";
import { psql } from "./names";
import runShell from "./runShell";

/**
 * Cleans up after the shard migration on failure.
 */
export default async function resultAbort({
  fromDsn,
  toDsn,
  schema,
}: {
  fromDsn: string;
  toDsn: string;
  schema: string;
}): Promise<void> {
  await cleanUpPubSub({ fromDsn, toDsn, schema, quiet: false });
  await runShell(
    psql(toDsn),
    `DROP schema IF EXISTS ${schema} CASCADE`,
    `Dropping destination semi-migrated schema(s)`
  );
}
