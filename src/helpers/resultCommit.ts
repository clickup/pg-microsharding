import cleanUpPubSub from "./cleanUpPubSub";
import { libSchema, psql, schemaNew, schemaOld, shardNo } from "./names";
import runShell from "./runShell";

/**
 * Cleans up after the shard migration on success.
 */
export default async function resultCommit({
  activateOnDestination,
  fromDsn,
  toDsn,
  schema,
}: {
  activateOnDestination: boolean;
  fromDsn: string;
  toDsn: string;
  schema: string;
}): Promise<void> {
  await cleanUpPubSub({ fromDsn, toDsn, schema, quiet: false });

  if (activateOnDestination) {
    const shard = shardNo(schema);
    await runShell(
      psql(fromDsn),
      (shard !== null
        ? `SELECT ${libSchema()}.sharding_ensure_inactive(${shard}); `
        : "") + `ALTER schema ${schema} RENAME TO ${schemaOld(schema)}`,
      "Renaming & deactivating schema on the source"
    );
    if (shard !== null) {
      await runShell(
        psql(toDsn),
        `SELECT ${libSchema()}.sharding_ensure_active(${shard})`,
        "Activating shard on the destination"
      );
    }
  } else {
    await runShell(
      psql(toDsn),
      `DROP SCHEMA IF EXISTS ${schemaNew(schema)} CASCADE; ` +
        `ALTER SCHEMA ${schema} RENAME TO ${schemaNew(schema)}`,
      `Renaming just migrated shard on the destination to ${schemaNew(schema)}`
    );
  }
}
