import rebalance from "../rebalance";

test("rebalance", async () => {
  runSnapshot([]);
  runSnapshot([["m1", [1]]]);
  runSnapshot([
    ["m1", [1]],
    ["m2", []],
  ]);
  runSnapshot([["m1", [1, 2]]]);
  runSnapshot([
    ["m1", [1, 2]],
    ["m2", []],
  ]);
  runSnapshot([
    ["m1", [1, 2]],
    ["m2", [3]],
  ]);
  runSnapshot([
    ["m1", [1]],
    ["m2", [2, 3]],
  ]);
  runSnapshot([
    ["m1", [1, 2, 3, 4]],
    ["m2", []],
  ]);
  runSnapshot([
    ["m1", [1, 2, 3, 4]],
    ["m2", []],
    ["m3", []],
  ]);
  runSnapshot([
    ["m1", [1, 2, 3]],
    ["m2", []],
    ["m3", []],
    ["m4", []],
  ]);
  runSnapshot([
    ["m1", [1, 2, 3]],
    ["m2", []],
    ["m3", []],
    ["m4", []],
    ["m5", []],
  ]);
  runSnapshot(
    [
      ["m1", [1, 2]],
      ["m2", [3, 4]],
      ["m3", [5, 6]],
    ],
    ["m3"]
  );
  runSnapshot(
    [
      ["m1", [1, 2]],
      ["m2", [3, 4]],
      ["m3", [5, 6]],
    ],
    ["m2", "m3"]
  );
  await expect(
    (async () =>
      runSnapshot(
        [
          ["m1", [1, 2]],
          ["m2", [3, 4]],
          ["m3", [5, 6]],
        ],
        ["m1", "m2", "m3"]
      ))()
  ).rejects.toThrow(Error);
});

function runSnapshot(
  input: Array<[string, number[]]>,
  decommissionDBs: string[] = []
): void {
  const res = rebalance(new Map(input), decommissionDBs);
  const inputStr = input.map(([db, shards]) => `  ${db}: [${shards}]\n`);
  const outputStr = [...res.shardsByDBs.entries()].map(
    ([db, shards]) => `  ${db}: [${shards}]\n`
  );
  const movesStr = res.moves.map(
    ({ from, to, shard }) => `  ${shard}: ${from}->${to}\n`
  );
  expect(
    "\n" +
      inputStr.join("") +
      "===\n" +
      movesStr.join("") +
      "===\n" +
      outputStr.join("")
  ).toMatchSnapshot();
}
