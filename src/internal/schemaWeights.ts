import { psql } from "./names";
import { runShell } from "./runShell";

const FUNC_NAME = "microsharding_schema_weights_";
const SEP = ":";

/**
 * Returns weights for each schema in the list. SQL query in weightSql should
 * return a numeric value with optional units after it; the units should be the
 * same in all responses and are ignored while sorting.
 */
export async function schemaWeights({
  dsn,
  schemas,
  weightSql,
}: {
  dsn: string;
  schemas: string[];
  weightSql: string | undefined;
}): Promise<Map<string, string>> {
  weightSql ||= `
    SELECT round(sum(pg_total_relation_size(table_name::text)) / 1024 / 1024) || ' MB'
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
  `;
  const lines = await runShell(
    psql(dsn),
    [
      `CREATE FUNCTION pg_temp.${FUNC_NAME}(schema_name text) RETURNS text LANGUAGE plpgsql
        AS $$
        BEGIN
          EXECUTE format('SET search_path TO %I', schema_name);
          RETURN (${weightSql.trim()});
        END;
        $$`,
      schemas
        .map(
          (schema) =>
            `SELECT '${schema}' || ':' || pg_temp.${FUNC_NAME}('${schema}')`,
        )
        .join("\nUNION ALL\n"),
    ].join("; "),
  );
  return new Map(
    lines
      .filter((line) => line.includes(SEP))
      .map((line) => line.split(SEP) as [string, string]),
  );
}
