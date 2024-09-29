import compact from "lodash/compact";
import { listActiveSchemas } from "../internal/listActiveSchemas";
import { shardNo } from "../internal/names";
import { schemaWeights } from "../internal/schemaWeights";

/**
 * Similar to listActiveSchemas(), but also returns the weight of each
 * microshard and its number.
 *
 * Returns null in case this DSN needs to be excluded by the caller completely
 * (e.g. when includeIsolatedShard0=false, and it's an isolated island with
 * shard 0).
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
  weightColName: string;
  weight: number;
  unit: string | undefined;
  other: Record<string, string>;
  schema: string;
  no: number;
}> | null> {
  const schemas = await listActiveSchemas({ dsn });

  if (!includeIsolatedShard0) {
    // If we have a dedicated island with only a global shard (shard 0) on it,
    // exclude it from the islands of the rebalance process.
    if (schemas.length === 1 && shardNo(schemas[0]) === 0) {
      return null;
    }
  }

  const weights = await schemaWeights({ dsn, schemas, weightSql });
  return compact(
    [...weights.entries()].map(([schema, shard]) => {
      const no = shardNo(schema);
      return no !== null ? { ...shard, schema, no } : null;
    }),
  );
}
