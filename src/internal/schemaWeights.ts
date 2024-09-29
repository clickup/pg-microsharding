import mapValues from "lodash/mapValues";
import omit from "lodash/omit";
import { psql } from "./names";
import { quoteLiteral } from "./quoteLiteral";
import { runShell } from "./runShell";

const FUNC_NAME = "microsharding_schema_weights_";

export const WEIGHT_COL_NAME_DEFAULT = "Weight";

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
}): Promise<
  Map<
    string,
    {
      weightColName: string;
      weight: number;
      unit: string | undefined;
      other: Record<string, string>;
    }
  >
> {
  weightSql ||= `
    SELECT 
      round(sum(pg_total_relation_size(quote_ident(table_name::text))) / 1024 / 1024) || ' MB' AS "Size",
      count(1) AS "Tables"
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
          RETURN (SELECT row_to_json(r) FROM (${weightSql.trim()}) r);
        END;
        $$`,
      schemas
        .map(
          (schema) =>
            `SELECT ${quoteLiteral(schema)}, * FROM pg_temp.${FUNC_NAME}(${quoteLiteral(schema)})`,
        )
        .join("\nUNION ALL\n"),
    ].join(";\n"),
  );
  return new Map(
    lines
      .filter((line) => line.includes("|"))
      .map((line) => {
        const pos = line.indexOf("|");
        const [schema, json] = [
          line.substring(0, pos),
          line.substring(pos + 1),
        ];
        const row: Record<string, unknown> = json ? JSON.parse(json) : {};
        const weightColName = Object.keys(row)[0] || undefined;
        const weightWithUnit = weightColName
          ? String(row[weightColName] || "")
          : "";
        const [weight, unit] = weightWithUnit.match(/^(\d+)(.*)$/s)
          ? [parseFloat(RegExp.$1), RegExp.$2.trim()]
          : [0, undefined];
        return [
          schema,
          {
            weightColName:
              !weightColName || weightColName.startsWith("?")
                ? WEIGHT_COL_NAME_DEFAULT
                : weightColName,
            weight,
            unit,
            other: mapValues(
              weightColName ? omit(row, weightColName) : row,
              String,
            ),
          },
        ];
      }),
  );
}
