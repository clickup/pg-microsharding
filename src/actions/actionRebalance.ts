import { execSync } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import compact from "lodash/compact";
import first from "lodash/first";
import flatten from "lodash/flatten";
import sumBy from "lodash/sumBy";
import type { ParsedArgs } from "minimist";
import prompts from "prompts";
import { fileSync, setGracefulCleanup } from "tmp";
import { rebalance } from "../api/rebalance";
import { chunkIntoN } from "../internal/chunkIntoN";
import { isTrueValue } from "../internal/isTrueValue";
import { print, section } from "../internal/logging";
import { dsnFromToShort, dsnShort } from "../internal/names";
import { normalizeDsns } from "../internal/normalizeDsns";
import { pluralize } from "../internal/pluralize";
import { shellQuote } from "../internal/shellQuote";
import { calcIslandWeights } from "./actionList";

const TMUX_SESSION = "pg-microsharding-rebalance";
const ACTIVE_BG = "#000033";

/**
 * Runs a series of shard modes, concurrently, using TMUX if available.
 */
export async function actionRebalance(args: ParsedArgs): Promise<boolean> {
  try {
    execSync("which tmux", { stdio: "ignore" });
  } catch {
    throw "TMUX is required to run this action. Please install it.";
  }

  // Try to reattach to an existing session instead of starting a new one (in
  // case we e.g. got disconnected).
  try {
    execSync(`tmux attach-session -d -t ${TMUX_SESSION} 2>/dev/null`, {
      stdio: "inherit",
    });
    return true;
  } catch {
    // No such session yet.
  }

  const dsns = await normalizeDsns(args["dsns"] || args["dsn"]);
  if (dsns.length === 0) {
    throw "Please provide --dsns, DB DSNs to rebalance shards against";
  }

  const activateOnDestination = isTrueValue(args["activate-on-destination"]);
  if (activateOnDestination === undefined) {
    throw "Please provide --activate-on-destination=yes or --activate-on-destination=no";
  }

  const weightSql = args["weight-sql"] || undefined;
  const decommissionDsns = await normalizeDsns(
    args["decommission"] || args["decomission"],
    dsns,
  );
  const parallelism = Number(args["parallelism"] ?? "") || 3;
  const deactivateSQL = String(args["deactivate-sql"] || "") || undefined;

  // Prepare the list of shards except the global shard (we never move it while
  // doing rebalance, it can always be done manually).
  const { islandNosToDsn, islands } = await calcIslandWeights({
    dsns,
    weightSql,
    includeIsolatedShard0: false,
  });

  section("CURRENT islands weights:");
  print(inspectIslandsWeights(islandNosToDsn, islands));

  const dsnsToIslandNo = new Map([...dsns.entries()].map(([k, v]) => [v, k]));
  const decommissionIslandNos = decommissionDsns.map((dsn) => {
    const islandNo = dsnsToIslandNo.get(dsn);
    if (islandNo === undefined) {
      throw `No such island in the list: "${dsnShort(dsn)}"`;
    } else {
      return islandNo;
    }
  });

  const groupedMoves = rebalance(islands, decommissionIslandNos).map(
    ({ from, to, shards }) => ({
      fromDsn: islandNosToDsn.get(from)!,
      toDsn: islandNosToDsn.get(to)!,
      shards,
    }),
  );
  const moves = flatten(
    groupedMoves.map(({ fromDsn, toDsn, shards }) =>
      shards.map(({ no }) => ({ fromDsn, toDsn, no })),
    ),
  );

  if (moves.length === 0) {
    section(
      `Shards are already fairly distributed among ${pluralize(islandNosToDsn.size, "island")}.`,
    );
    return true;
  }

  section(`Proposed moves (${moves.length}):`);
  print(
    groupedMoves
      .map(
        ({ fromDsn, toDsn, shards }) =>
          `- ${dsnFromToShort(fromDsn, toDsn)}: shards [` +
          shards.map((shard) => shard.no).join(", ") +
          "]\n",
      )
      .join(""),
  );

  section("FUTURE weights after the above moves:");
  print(inspectIslandsWeights(islandNosToDsn, islands));

  const validResponse = "rebalance";
  const response = await prompts({
    type: "text",
    name: "value",
    message: `Type "${validResponse}" to proceed with the moves:`,
    validate: (value: string) =>
      value !== validResponse
        ? `Enter "${validResponse}" to confirm, ^C to skip`
        : true,
  });
  if (response.value !== validResponse) {
    return false;
  }

  const tmpDir = `/tmp/${TMUX_SESSION}`;
  mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
  setGracefulCleanup();

  const tmuxCommands: string[] = ["set -e"];

  for (const [i, sequence] of chunkIntoN(moves, parallelism).entries()) {
    const nodeCommands: string[] = [
      "set -e",
      String.raw`trap 'test $? -eq 0 && printf "\033[1;32mDONE. Press ^C to close this pane..." || printf "\033[0;31mFAILURE. Press ^C to close this pane..."; sleep 100000' EXIT`,
    ];

    for (const [i, { fromDsn, toDsn, no }] of sequence.entries()) {
      const progress = `${i + 1} of ${sequence.length}`;
      const title = `${progress} | shard ${no} | ${dsnFromToShort(fromDsn, toDsn)}`;
      nodeCommands.push(
        `printf '\\033]2;%s\\033\\' ' ${title} '`,
        [
          "node",
          resolve(`${__dirname}/../cli`),
          "move",
          "--shard",
          no.toString(),
          "--from",
          fromDsn,
          "--to",
          toDsn,
          "--activate-on-destination",
          activateOnDestination ? "yes" : "no",
          ...(deactivateSQL ? ["--deactivate-sql", deactivateSQL] : []),
        ]
          .map((v) => shellQuote(v))
          .join(" "),
        "echo",
      );
    }

    // TMUX has a limit on the command total length:
    // https://github.com/tmux/tmux/issues/254. So instead of passing the big
    // script, we instead put this script in a temporary file and then run it
    // using the `bash this-temp-file` plain command via TMUX. Notice that the
    // temporary files are auto-removed, but if the script is terminated cruelly
    // with e.g. -9 signal, they may linger; it's not a big deal since they are
    // cleaned up by linux tmpwatch anyway, we just don't have a better option.
    const tmpFile = fileSync({
      tmpdir: tmpDir,
      prefix:
        "shards-" +
        sequence
          .map(({ no }) => no)
          .slice(0, 10)
          .join("-"),
    }).name;
    writeFileSync(tmpFile, nodeCommands.join("\n"));

    if (i === 0) {
      tmuxCommands.push(
        `tmux new-session -s ${TMUX_SESSION} -d bash ${tmpFile}`,
      );
    } else {
      tmuxCommands.push(
        `tmux split-window -f bash ${tmpFile}`,
        "tmux select-layout tiled",
      );
    }
  }

  tmuxCommands.push(
    'tmux bind -n "C-c" confirm-before -p "Confirm SIGINT? (y/n)" "send-keys C-c"',
    `tmux set -g window-active-style "bg=${ACTIVE_BG}"`,
    `tmux set -g pane-active-border-style "bg=${ACTIVE_BG}"`,
    "tmux set mouse on",
    "tmux set pane-border-status top",
    'tmux set pane-border-format "#T"',
    "tmux select-layout tiled",
    `tmux attach-session -d -t ${TMUX_SESSION}`,
  );

  execSync(tmuxCommands.join("\n"), { stdio: "inherit" });
  return true;
}

/**
 * Prints weights of islands and their shards.
 */
function inspectIslandsWeights(
  dsnByIslandNo: Map<number, string>,
  islands: Map<
    number,
    Array<{ weight: number; unit: string | undefined; no: number }>
  >,
): string {
  const totalWeight =
    sumBy([...islands.values()], (shards) =>
      sumBy(shards, ({ weight }) => weight),
    ) || 1;
  const unit = first(
    compact([...islands.values()].map((shards) => first(shards)?.unit)),
  );
  return [...islands.entries()]
    .map(([no, shards]) => {
      const islandWeight = sumBy(shards, ({ weight }) => weight);
      return (
        `- ${dsnShort(dsnByIslandNo.get(no)!)}: ` +
        `${Math.round((islandWeight / totalWeight) * 100)}% ` +
        `(${islandWeight}${unit ? ` ${unit}` : ""}), ${pluralize(shards.length, "microshard")}\n`
      );
    })
    .join("");
}
