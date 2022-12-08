import difference from "lodash/difference";
import range from "lodash/range";
import sumBy from "lodash/sumBy";

export interface Move<TDB, TShard> {
  from: TDB;
  to: TDB;
  shard: TShard;
}

/**
 * Returns shards rebalance plan for the client to execute to distribute shards
 * evenly across databases. If a DB is passed in decommissionDBs, then all the
 * shards from it will be migrated out.
 */
export default function rebalance<TDB, TShard>(
  shardsByDBs: ReadonlyMap<TDB, TShard[]>,
  decommissionDBs: TDB[] = []
): {
  shardsByDBs: ReadonlyMap<TDB, TShard[]>;
  moves: Array<Move<TDB, TShard>>;
} {
  const numShards = sumBy([...shardsByDBs.values()], (shards) => shards.length);
  const map = [...shardsByDBs.entries()].map(([db, shards]) => ({
    db,
    needShards: 0,
    shards: [...shards],
  }));

  const finalDBs = difference([...shardsByDBs.keys()], decommissionDBs);
  if (shardsByDBs.size > 0 && finalDBs.length === 0) {
    throw Error(
      "You can't decommission all of the DBs, at least one should remain"
    );
  }

  const chunks = evenChunks(range(0, numShards), finalDBs.length);
  for (const entry of map) {
    entry.needShards = decommissionDBs.includes(entry.db)
      ? 0
      : chunks.shift()!.length;
  }

  const moves: Array<Move<TDB, TShard>> = [];
  for (const from of map) {
    const shardsToMove = from.shards.splice(from.needShards);
    for (const shard of shardsToMove) {
      for (const to of map) {
        if (to.shards.length < to.needShards) {
          moves.push({ from: from.db, to: to.db, shard });
          to.shards.push(shard);
          break;
        }
      }
    }
  }

  return {
    shardsByDBs: new Map(map.map(({ db, shards }) => [db, shards])),
    moves,
  };
}

function evenChunks<T>(input: T[], n: number): T[][] {
  const ret = Array(n);
  for (let i = 0, j = 0; i < ret.length; i++) {
    const sliceEnd = Math.round((i + 1) * (input.length / n));
    ret[i] = input.slice(j, sliceEnd);
    j = sliceEnd;
  }

  return ret;
}
