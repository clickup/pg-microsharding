import chalk from "chalk";
import chunk from "lodash/chunk";
import compact from "lodash/compact";
import first from "lodash/first";
import flatten from "lodash/flatten";
import mapValues from "lodash/mapValues";
import max from "lodash/max";
import range from "lodash/range";
import sum from "lodash/sum";
import sumBy from "lodash/sumBy";
import type { ParsedArgs } from "minimist";
import { table } from "table";
import { weights } from "../api/weights";
import { chunkIntoN } from "../internal/chunkIntoN";
import { indent, print, progress, section } from "../internal/logging";
import { mapJoin } from "../internal/mapJoin";
import { dsnShort } from "../internal/names";
import { normalizeDsns } from "../internal/normalizeDsns";
import { pluralize } from "../internal/pluralize";
import { WEIGHT_COL_NAME_DEFAULT } from "../internal/schemaWeights";

const DEBUG_RENDER_MUL = parseInt(process.env["DEBUG_RENDER_MUL"] ?? "0") || 0;

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

  if (DEBUG_RENDER_MUL > 0) {
    [...islands.values()].forEach((shards) =>
      shards.push(...flatten(range(DEBUG_RENDER_MUL - 1).map(() => shards))),
    );
  }

  const grandTotalWeightColName =
    first(flatten([...islands.values()]).map((s) => s.weightColName)) ??
    WEIGHT_COL_NAME_DEFAULT;
  const grandTotalWeight = sum(
    flatten([...islands.values()]).map((s) => s.weight),
  );
  const grandTotalUnit = first(
    compact(flatten([...islands.values()]).map((s) => s.unit)),
  );
  const grandTotalShards = sum([...islands.values()].map((s) => s.length));

  const firstShard = first(first([...islands.values()]));
  const header = ["Microshard"].concat(
    firstShard
      ? [
          firstShard.weightColName,
          `${firstShard.weightColName} %`,
          ...Object.keys(firstShard.other),
        ]
      : [WEIGHT_COL_NAME_DEFAULT, `${WEIGHT_COL_NAME_DEFAULT} %`],
  );

  // Width in characters of the longest rendered table row.
  const tableWidth =
    2 + // indent
    header.length * 3 + // left borders and paddings around each cell
    1 + // last border
    (max(
      // content of the longest row
      flatten([...islands.values()]).map(
        ({ weight, unit, other, no }) =>
          Math.max(header[0].length, no.toString().length) +
          Math.max(
            header[1].length,
            weight.toString().length + (unit ? unit.length + 1 : 0),
          ) +
          Math.max(header[2].length, "100%".length) +
          sum(
            Object.entries(other).map(([k, v]) => Math.max(k.length, v.length)),
          ),
      ),
    ) ?? 0);

  const maxTablesSideBySide = Math.trunc(
    ((process.stdout.columns || 80) - 10) / tableWidth,
  );

  for (const [islandNo, shards] of islands) {
    const dsn = islandNosToDsn.get(islandNo)!;
    section(
      `${dsnShort(dsn)} — ` + `${pluralize(shards.length, "microshard")}`,
    );
    if (shards.length === 0) {
      print(indent(table([["No microshards"]])));
      continue;
    }

    const totalWeight: number = sumBy(shards, (shard) => shard.weight);
    const totalUnit: string | undefined = shards[0].unit;
    const totalOther: Record<string, string | undefined> = mapValues(
      shards[0].other,
      (_, k) => {
        const values = compact(
          shards.map((s) => s.other[k]).map((v) => parseFloat(v)),
        );
        return values.length > 0 ? sum(values).toString() : undefined;
      },
    );

    const shardTables =
      islands.size === 1 ||
      maxTablesSideBySide === 0 ||
      grandTotalShards + islands.size * 8 < (process.stdout.rows || 25) ||
      shards.length <= 4
        ? [shards]
        : shards.length / maxTablesSideBySide < 2
          ? chunk(shards, 2)
          : chunkIntoN(shards, maxTablesSideBySide);
    const tables = shardTables.map((shards, tableNo) =>
      indent(
        table(
          compact([
            header,
            ...shards.map(({ no, weight, unit, other }) =>
              [
                no.toString(),
                weight + (unit ? ` ${unit}` : ""),
                totalWeight !== 0
                  ? `${((weight / totalWeight) * 100).toFixed(1)}%`
                  : "-",
                ...Object.values(other),
              ].map((cell) => (no === 0 ? chalk.yellow(cell) : cell)),
            ),
            tableNo === 0 &&
              [
                "total",
                totalWeight + (totalUnit ? ` ${totalUnit}` : ""),
                "100%",
                ...Object.values(totalOther).map((v) => v ?? ""),
              ].map((cell) => chalk.bold(cell)),
          ]),
          {
            drawHorizontalLine: (i, rowCount) =>
              i === 0 ||
              i === 1 ||
              (tableNo === 0 && i === rowCount - 1) ||
              i === rowCount,
          },
        ),
      ),
    );
    print(glueHorizontally(tables));
  }

  print(
    chalk.bgBlue(
      chalk.whiteBright(
        " " +
          `TOTAL ${grandTotalWeightColName.toUpperCase()}: ${grandTotalWeight}` +
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
              return shards === null ? null : [islandNo, shards];
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

function glueHorizontally(tables: string[]): string {
  const rowsByTable = tables.map((table) => table.split("\n"));
  const maxRows = max(rowsByTable.map((rows) => rows.length)) ?? 0;

  for (const rows of rowsByTable) {
    const maxWidth = rows[0].length;
    for (let i = 0; i < maxRows; i++) {
      rows[i] ||= "";
      rows[i] = rows[i].padEnd(maxWidth, " ");
    }
  }

  const result = range(maxRows).map(() => [] as string[]);
  for (const rows of rowsByTable) {
    for (const [i, col] of rows.entries()) {
      result[i].push(col);
    }
  }

  return result.map((lineArray) => lineArray.join("")).join("\n");
}
