import chalk from "chalk";
import compact from "lodash/compact";
import sumBy from "lodash/sumBy";
import type { ParsedArgs } from "minimist";
import { table } from "table";
import { weights } from "../api/weights";
import { indent, print, progress, section } from "../internal/logging";
import { mapJoin } from "../internal/mapJoin";
import { dsnShort } from "../internal/names";
import { normalizeDsns } from "../internal/normalizeDsns";
import { pluralize } from "../internal/pluralize";

/**
 * Shows the list of microshards and their weights.
 */
export async function actionList(args: ParsedArgs): Promise<boolean> {
  const weightSql = args["weight-sql"] || undefined;

  const dsns = await normalizeDsns(args["dsns"] || args["dsn"]);
  if (dsns.length === 0) {
    throw "Please provide --dsn or --dsns, DB DSNs to remove old schemas from";
  }

  const { islandNosToDsn, islands } = await calcIslandWeights({
    dsns,
    weightSql,
    includeIsolatedShard0: true,
  });

  let grandTotalWeight = 0;
  let grandTotalUnit = "";
  let grandTotalShards = 0;

  for (const [islandNo, shards] of islands) {
    const dsn = islandNosToDsn.get(islandNo)!;
    section(
      `${dsnShort(dsn)} — ` + `${pluralize(shards.length, "microshard")}`,
    );
    if (shards.length === 0) {
      print(indent(table([["No microshards"]])));
      continue;
    }

    const totalWeight = sumBy(shards, (shard) => shard.weight);
    const totalUnit = shards[0].unit;

    const header = ["Microshard", "Weight", "Weight %"];
    print(
      indent(
        table(
          [
            header,
            ...shards.map(({ no, weight, unit }) =>
              [
                no.toString(),
                weight + (unit ? ` ${unit}` : ""),
                totalWeight !== 0
                  ? `${((weight / totalWeight) * 100).toFixed(1)}%`
                  : "-",
              ].map((cell) => (no === 0 ? chalk.yellow(cell) : cell)),
            ),
            ["total", totalWeight + (totalUnit ? ` ${totalUnit}` : ""), "100%"],
          ],
          {
            drawHorizontalLine: (i, rowCount) =>
              i === 0 || i === 1 || i === rowCount - 1 || i === rowCount,
          },
        ),
      ),
    );

    grandTotalWeight += totalWeight;
    grandTotalUnit ||= totalUnit || "";
    grandTotalShards += shards.length;
  }

  print(
    chalk.bgBlue(
      chalk.whiteBright(
        " " +
          `TOTAL WEIGHT: ${grandTotalWeight}` +
          (grandTotalUnit ? ` ${grandTotalUnit}` : "") +
          `, ${pluralize(islands.size, "island")}, ${pluralize(grandTotalShards, "microshard")}` +
          " ",
      ),
    ),
  );

  return true;
}

export async function calcIslandWeights({
  dsns,
  weightSql,
  includeIsolatedShard0,
}: {
  dsns: string[];
  weightSql: string | undefined;
  includeIsolatedShard0: boolean;
}): Promise<{
  islandNosToDsn: Map<number, string>;
  islands: Map<number, NonNullable<Awaited<ReturnType<typeof weights>>>>;
}> {
  try {
    // Prepare the list of shards except the global shard (we never move it while
    // doing rebalance, it can always be done manually).
    const pendingPrefix = "Calculating microshard sizes on: ";
    const pendingDsns = new Set<string>();
    const islandNosToDsn = new Map([...dsns.entries()]);
    const islands = new Map(
      compact(
        await mapJoin(
          [...islandNosToDsn.entries()],
          async ([islandNo, dsn]) => {
            try {
              pendingDsns.add(dsnShort(dsn));
              progress(pendingPrefix + [...pendingDsns].join(", "));
              const shards = await weights({
                dsn,
                weightSql,
                includeIsolatedShard0,
              });
              return shards === null ? null : [islandNo, compact(shards)];
            } finally {
              pendingDsns.delete(dsnShort(dsn));
              progress(pendingPrefix + [...pendingDsns].join(", "));
            }
          },
        ),
      ),
    );
    return { islandNosToDsn, islands };
  } finally {
    progress.clear();
  }
}
