import compact from "lodash/compact";
import { cleanUpPubSub } from "./cleanUpPubSub";
import { getTablesInSchema } from "./getTablesInSchema";
import { libSchema, psql, schemaNew, schemaOld, shardNo } from "./names";
import { quoteIdent } from "./quoteIdent";
import { quoteLiteral } from "./quoteLiteral";
import { runShell } from "./runShell";

/**
 * Cleans up after the shard migration on success.
 */
export async function resultCommit({
  activateOnDestination,
  deactivateSQL,
  fromDsn,
  toDsn,
  schema,
}: {
  activateOnDestination: boolean;
  deactivateSQL?: string;
  fromDsn: string;
  toDsn: string;
  schema: string;
}): Promise<void> {
  const tables = await getTablesInSchema({ fromDsn, schema });

  await cleanUpPubSub({ fromDsn, toDsn, schema, quiet: false });

  // E.g. 2023-01-09T07:09:54.253Z
  const dateSuffix = new Date()
    .toISOString()
    .replace(/\..*$/, "")
    .replace(/[-T:Z]/g, "");

  if (activateOnDestination) {
    const shard = shardNo(schema);
    await runShell(
      psql(fromDsn),
      compact([
        "BEGIN",
        shard !== null &&
          `SELECT ${libSchema()}.microsharding_ensure_inactive(${shard})`,
        `ALTER schema ${schema} RENAME TO ${schemaOld(schema, dateSuffix)}`,
        "COMMIT",
      ]).join("; "),
      "Renaming & deactivating shard on the source",
    );
    if (shard !== null) {
      await runShell(
        psql(toDsn),
        `SELECT ${libSchema()}.microsharding_ensure_active(${shard})`,
        "Activating shard on the destination",
      );
    }

    if (deactivateSQL && tables.length > 0) {
      await runShell(
        psql(fromDsn),
        tables
          .map(
            (table) =>
              deactivateSQL.replace(
                /\$1/g,
                quoteLiteral(`${schema}.${quoteIdent(table)}`),
              ) + ";",
          )
          .join("\n"),
        "Running custom deactivation script for shard tables",
      );
    }
  } else {
    await runShell(
      psql(toDsn),
      `DROP SCHEMA IF EXISTS ${schemaNew(schema)} CASCADE; ` +
        `ALTER SCHEMA ${schema} RENAME TO ${schemaNew(schema)}`,
      `Renaming just migrated shard on the destination to ${schemaNew(schema)}`,
    );
  }
}
