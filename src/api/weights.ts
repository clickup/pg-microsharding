import compact from "lodash/compact";
import { listActiveSchemas } from "../internal/listActiveSchemas";
import { shardNo } from "../internal/names";
import { schemaWeights } from "../internal/schemaWeights";

/**
 * Similar tp listActiveSchemas(), but also returns the weight of each
 * microshard and its number.
 */
export async function weights({
  dsn,
  weightSql,
  includeIsolatedShard0,
}: {
  dsn: string;
  weightSql: string | undefined;
  includeIsolatedShard0: boolean;
}): Promise<Array<{
  weight: number;
  unit: string | undefined;
  schema: string;
  no: number;
}> | null> {
  const schemas = await listActiveSchemas({ dsn });

  if (!includeIsolatedShard0) {
    // If we have a dedicated island with only a global shard (shard 0) on it,
    // exclude it from the islands of the rebalance process.
    if (schemas.length === 1 && shardNo(schemas[0]) === 0) {
      return [];
    }
  }

  const weights = await schemaWeights({ dsn, schemas, weightSql });
  return compact(
    [...weights.entries()].map(([schema, weightWithUnit]) => {
      const no = shardNo(schema);
      const [weight, unit] = weightWithUnit.match(/^(\d+)(.*)$/s)
        ? [parseFloat(RegExp.$1), RegExp.$2.trim()]
        : [0, undefined];
      return no !== null ? { weight, unit, schema, no } : null;
    }),
  );
}
