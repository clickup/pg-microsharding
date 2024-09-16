import assert from "assert";
import compact from "lodash/compact";
import difference from "lodash/difference";
import flatten from "lodash/flatten";
import groupBy from "lodash/groupBy";
import minBy from "lodash/minBy";
import sortBy from "lodash/sortBy";
import sumBy from "lodash/sumBy";
import without from "lodash/without";

const SHARD_WEIGHT_MOVE_FROM_OVERLOADED_TO_OVERLOADED_FACTOR = 0.75;
const DEFAULT_FRACTION_OF_MEDIAN_TO_CONSIDER_EMPTY = 0.1;

interface Shard {
  weight: number;
}

interface Island {
  no: number;
  sumWeight: number;
  shards: Set<Shard>;
}

/**
 * Accepts a list of islands (an island is a collection of shards with different
 * weights). Modifies it to make the shards being distributed more fairly.
 * Returns the list of shards moves.
 *
 * ChatGPT mentions several related academical problems:
 * - "linear partitioning"
 * - "balanced partition"
 * - "partition problem"
 *
 * Unfortunately, none of the above approaches works out of the box due to
 * corner cases and heuristics we have.
 *
 * The current algorithm implemented is not perfect intentionally: it doesn't
 * try to achieve a fully-fair distribution, because it would produce way too
 * many moves otherwise (shards moves are expensive). Instead, it makes
 * trade-offs:
 * 1. Tries to unload the largest "overloaded" shards to the smallest island if
 *    such island wouldn't appear overloaded after that.
 * 2. If there is no such island in (1) (i.e. no matter where we move it, the
 *    destination will be overloaded), it may still move the shard to the
 *    smallest island, BUT only it the final benefit of the move would be more
 *    than SHARD_WEIGHT_MOVE_FROM_OVERLOADED_TO_OVERLOADED_FACTOR fraction of
 *    the shard's weight. (We don't want to pay the price for a move which won't
 *    move the needle much.)
 * 3. Compensates large shards relocations with the corresponding number of
 *    small shard relocations, so largest shards and smallest shards are
 *    redistributed more or less in sync with each other, and there will be e.g.
 *    no island with just 2 biggest shards, whilst other islands have tens of
 *    them.
 * 4. Also, a special treatment is applied to "empty" shards. They are treated
 *    as "filled in the future". The shard is considered "empty" if its weight
 *    is less than fractionOfMedianToConsiderEmpty of a median shard's weight.
 *    Such shards are distributed uniformly among the islands, not looking at
 *    their weights; this prevents the situation when most of the "empty" shards
 *    appear on the same island in the end.
 *
 * All those trade-offs produce a slightly imbalanced result. In real life, it
 * doesn't matter much though, because shards sizes are more or less equal.
 */
export function rebalance<TShard extends Shard>(
  islands: Map<number, readonly TShard[]>,
  decommissionIslandNos: number[] = [],
  fractionOfMedianToConsiderEmpty = DEFAULT_FRACTION_OF_MEDIAN_TO_CONSIDER_EMPTY,
): Array<{ from: number; to: number; shards: TShard[] }> {
  const islandsFrom = new Map<number, Island>(
    [...islands.entries()].map(([no, shards]) => [
      no,
      {
        no,
        sumWeight: sumBy(shards, ({ weight }) => weight),
        shards: new Set(shards),
      },
    ]),
  );

  const islandsTo = new Map(
    [...islandsFrom.entries()].map(([no, island]) => [
      no,
      { ...island, shards: new Set([...island.shards]) },
    ]),
  );
  decommissionIslands(islandsTo, decommissionIslandNos);
  const emptyShards = extractEmptyShards(
    islandsTo,
    fractionOfMedianToConsiderEmpty,
  );
  balanceIslands(islandsTo);
  injectShardsUniformly(islandsTo, emptyShards);

  const moves = buildMoves(islandsFrom, islandsTo);

  const shardsTo = new Map(
    [...islandsTo.values()].map(({ no, shards }) => [
      no,
      [...shards] as TShard[],
    ]),
  );

  const shardsFromOrder = new Map(
    flatten([...islandsFrom.values()].map(({ shards }) => [...shards])).map(
      (shard, i) => [shard, i],
    ),
  );

  islands.clear();
  for (const islandNo of islandsFrom.keys()) {
    islands.set(
      islandNo,
      sortBy(
        shardsTo.get(islandNo) ?? [],
        (shard) => shardsFromOrder.get(shard) ?? Infinity,
      ),
    );
  }

  return Object.values(groupBy(moves, ({ from, to }) => `${from}:${to}`)).map(
    (moves) => ({
      from: moves[0].from,
      to: moves[0].to,
      shards: moves.map(({ shard }) => shard as TShard),
    }),
  );
}

/**
 * Performs islands re-balancing in-place.
 */
function balanceIslands(islands: Map<number, Island>): void {
  if (islands.size === 0) {
    return;
  }

  const shardsSortedDesc = sortBy(
    flatten(
      [...islands.values()].map((island) =>
        [...island.shards].map((shard) => [shard, island] as const),
      ),
    ),
    ([shard]) => -1 * shard.weight,
  );

  const desiredIslandWeight =
    sumBy(shardsSortedDesc, ([{ weight }]) => weight) / islands.size;

  let bigShardMovedWeight = 0;

  while (shardsSortedDesc.length > 0) {
    // First, try to evacuate ONE biggest shard of an OVERLOADED island to the
    // smallest island ONLY if it wouldn't overload it. Do it until we actually
    // succeed moving ONE shard (and skip the shards we couldn't find the new
    // "better" island for).
    while (shardsSortedDesc.length > 0) {
      const [shard, islandFrom] = shardsSortedDesc.shift()!; // biggest shard
      if (islandFrom.sumWeight > desiredIslandWeight) {
        // The island of this shard is overloaded, so try to move the shard off
        // to OTHER SMALLEST island.
        const islandTo = minBy(
          without([...islands.values()], islandFrom),
          ({ sumWeight }) => sumWeight,
        );
        if (islandTo) {
          const islandToNewWeight = islandTo.sumWeight + shard.weight;
          if (
            islandToNewWeight <= desiredIslandWeight ||
            islandFrom.sumWeight - islandToNewWeight >
              shard.weight *
                SHARD_WEIGHT_MOVE_FROM_OVERLOADED_TO_OVERLOADED_FACTOR
          ) {
            // The new island would NOT be overloaded after the move, so it's
            // better than the currently overloaded island.
            moveShard({ shard, islandFrom, islandTo });
            bigShardMovedWeight += shard.weight;
            break;
          }
        }
      }
    }

    // Then, to compensate this biggest shard relocation, redistribute N
    // SMALLEST shards of OVERLOADED islands to the smallest islands up until we
    // accumulate the total weight of the biggest shard we have just
    // redistributed.
    while (shardsSortedDesc.length > 0) {
      const [shard, islandFrom] = shardsSortedDesc[shardsSortedDesc.length - 1]; // smallest shard
      if (islandFrom.sumWeight > desiredIslandWeight) {
        if (bigShardMovedWeight >= shard.weight) {
          const islandTo = minBy(
            without([...islands.values()], islandFrom),
            ({ sumWeight }) => sumWeight,
          );
          if (
            islandTo &&
            islandTo.sumWeight < islandFrom.sumWeight &&
            score(islands, { shard, islandFrom, islandTo }) > score(islands)
          ) {
            shardsSortedDesc.pop();
            moveShard({ shard, islandFrom, islandTo });
            bigShardMovedWeight -= shard.weight;
            continue;
          }
        }
      }

      break;
    }
  }
}

/**
 * Removes islands which need to be decommissioned from the list of islands and
 * redistributes their shards uniformly (without looking at their weights).
 */
function decommissionIslands(
  islands: Map<number, Island>,
  islandNos: number[],
): void {
  if (islands.size === 0) {
    return;
  }

  const shards: Shard[] = [];
  for (const [no, island] of islands) {
    if (islandNos.includes(no)) {
      shards.push(...island.shards);
      islands.delete(no);
    }
  }

  if (islands.size === 0) {
    throw Error(
      "Can't decommission all islands: we need at least one remaining to put all the shards on",
    );
  }

  injectShardsUniformly(islands, shards);
}

/**
 * Removes shards smaller than a threshold from the islands and returns the
 * removed shards.
 */
function extractEmptyShards(
  islands: Map<number, Island>,
  fractionOfMedianToConsiderEmpty: number,
): Shard[] {
  const shardsSortedAsc = sortBy(
    flatten([...islands.values()].map((island) => [...island.shards])),
    ({ weight }) => weight,
  );
  if (shardsSortedAsc.length === 0) {
    return [];
  }

  const weightMedian =
    shardsSortedAsc[Math.trunc(shardsSortedAsc.length / 2)].weight;
  const weightThreshold = weightMedian * fractionOfMedianToConsiderEmpty;

  const emptyShards = [];
  for (const island of islands.values()) {
    const empty = [...island.shards].filter(
      ({ weight }) => weight <= weightThreshold,
    );
    island.shards = new Set(difference([...island.shards], empty));
    emptyShards.push(...empty);
  }

  return emptyShards;
}

/**
 * Injects shards to the list of islands uniformly, not considering their
 * weights.
 */
function injectShardsUniformly(
  islands: Map<number, Island>,
  shards: Shard[],
): void {
  const islandList = [...islands.values()];
  for (const shard of shards) {
    islandList[0].shards.add(shard);
    islandList.push(islandList.shift()!);
  }
}

/**
 * Builds the list of moves which would turn one list of islands into another
 * list of islands.
 */
function buildMoves(
  from: Map<number, Island>,
  to: Map<number, Island>,
): Array<{ from: number; to: number; shard: Shard }> {
  const shardsToIsland = new Map(
    flatten(
      [...to.values()].map((island) =>
        [...island.shards].map((shard) => [shard, island] as const),
      ),
    ),
  );
  return flatten(
    [...from.values()].map((from) =>
      compact(
        [...from.shards].map((shard) => {
          const to = shardsToIsland.get(shard)!;
          return from.no === to.no
            ? null
            : {
                from: from.no,
                to: shardsToIsland.get(shard)!.no,
                shard,
              };
        }),
      ),
    ),
  );
}

/**
 * Score of the cluster is the minimal sum weight among its islands. The bigger
 * the score, the more fair is the distribution.
 */
function score(
  islands: Map<number, Island>,
  afterMove?: {
    shard: Shard;
    islandFrom: Island;
    islandTo: Island;
  },
): number {
  return Math.min(
    ...[...islands.values()].map(
      (island) =>
        island.sumWeight -
        (afterMove?.islandFrom === island ? afterMove.shard.weight : 0) +
        (afterMove?.islandTo === island ? afterMove.shard.weight : 0),
    ),
  );
}

/**
 * Moves a shard from one island to another updating the island's sum weight.
 */
function moveShard({
  shard,
  islandFrom,
  islandTo,
}: {
  shard: Shard;
  islandFrom: Island;
  islandTo: Island;
}): void {
  assert(islandFrom.shards.has(shard));
  assert(!islandTo.shards.has(shard));
  islandFrom.shards.delete(shard);
  islandFrom.sumWeight -= shard.weight;
  islandTo.shards.add(shard);
  islandTo.sumWeight += shard.weight;
}
