import range from "lodash/range";

/**
 * Splits an array evenly across N resulting chunks. The size of each chunk will
 * be approximately arr.length / n (in case of imbalance, some chunks will be +1
 * larger and some smaller). Also, returns non-empty chunks only.
 */
export function chunkIntoN<T>(arr: T[], numChunks: number): T[][] {
  const size = arr.length / numChunks;
  return range(numChunks)
    .map((i) => arr.slice(Math.floor(i * size), Math.floor((i + 1) * size)))
    .filter((arr) => arr.length > 0);
}
