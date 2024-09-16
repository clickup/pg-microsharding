import first from "lodash/first";
import { libSchema, psql, schemaCleanupRe } from "../internal/names";
import { runShell } from "../internal/runShell";

/**
 * Removes old and semi-migrated schemas.
 */
export async function cleanup({
  dsn,
  noOldShards,
  confirm,
}: {
  dsn: string;
  noOldShards?: (oldSchemaNameRe: string) => Promise<void>;
  confirm?: (schemas: string[]) => Promise<boolean>;
}): Promise<void> {
  const dummyNo = 101;
  const schemaNameRe = first(
    await runShell(
      psql(dsn),
      `SELECT ${libSchema()}.microsharding_schema_name_(${dummyNo})`,
    ),
  )!.replace(new RegExp(`0*${dummyNo}0*`), "\\d+");
  const oldSchemaNameRe = schemaCleanupRe(schemaNameRe);

  const allSchemas = await runShell(
    psql(dsn),
    "SELECT nspname FROM pg_namespace",
  );
  const oldSchemas = allSchemas.filter((schema) =>
    schema.match(oldSchemaNameRe),
  );
  if (oldSchemas.length === 0) {
    await noOldShards?.(oldSchemaNameRe);
    return;
  }

  if (confirm && !(await confirm(oldSchemas))) {
    return;
  }

  // Remove sequentially, otherwise there is a high chance of having
  // shared_buffers OOM.
  for (const schema of oldSchemas) {
    await runShell(
      psql(dsn),
      `DROP SCHEMA ${schema} CASCADE`,
      `Dropping redundant schema ${schema}...`,
    );
  }
}
