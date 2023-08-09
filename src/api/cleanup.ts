import first from "lodash/first";
import { libSchema, psql, schemaCleanupRe } from "../helpers/names";
import runShell from "../helpers/runShell";

/**
 * Removes old and semi-migrated schemas.
 */
export default async function cleanup({
  dsn,
  confirm,
}: {
  dsn: string;
  confirm?: (schemas: string[]) => Promise<boolean>;
}): Promise<void> {
  const dummyNo = 101;
  const schemaNameRe = first(
    await runShell(
      psql(dsn),
      `SELECT ${libSchema()}._sharding_schema_name(${dummyNo})`
    )
  )!.replace(new RegExp(`0*${dummyNo}0*`), "\\d+");
  const oldSchemaNameRe = schemaCleanupRe(schemaNameRe);

  const allSchemas = await runShell(
    psql(dsn),
    "SELECT nspname FROM pg_namespace"
  );
  const oldSchemas = allSchemas.filter((schema) =>
    schema.match(oldSchemaNameRe)
  );
  if (oldSchemas.length === 0) {
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
      `Dropping redundant schema ${schema}...`
    );
  }
}
