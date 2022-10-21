import range from "lodash/range";
import sumBy from "lodash/sumBy";

export interface Move<TDB, TShard> {
  from: TDB;
  to: TDB;
  shard: TShard;
}

/**
 * Returns shards rebalance plan for the client to execute to distribute shards
 * evenly across databases.
 */
export default function rebalance<TDB, TShard>(
  shardsByDBs: ReadonlyMap<TDB, TShard[]>
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
  const chunks = evenChunks(range(0, numShards), shardsByDBs.size);
  for (const [i, chunk] of chunks.entries()) {
    map[i].needShards = chunk.length;
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
