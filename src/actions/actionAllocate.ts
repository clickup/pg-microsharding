import type { ParsedArgs } from "minimist";
import { allocate } from "../api/allocate";
import { isTrueValue } from "../internal/isTrueValue";
import { normalizeDsns } from "../internal/normalizeDsns";

/**
 * Ensures that some shards exist.
 */
export async function actionAllocate(args: ParsedArgs): Promise<boolean> {
  const dsns = await normalizeDsns(args["dsns"] || args["dsn"]);
  if (dsns.length === 0) {
    throw "Please provide --dsn, DB DSN to allocate microshard(s) at";
  }

  let from: number;
  let to: number;
  if ((args["shard"] || args["shards"])?.match(/^(\d+)(?:-(\d+))?$/)) {
    from = parseInt(RegExp.$1, 10);
    to = parseInt(RegExp.$2 || String(from), 10);
  } else {
    throw "Please provide --shard=N or --shards=N-M, starting and ending shard numbers";
  }

  let migrateCmd: string;
  if (args["migrate-cmd"]) {
    migrateCmd = args["migrate-cmd"];
  } else {
    throw "Please provide --migrate-cmd, shell command to run migrations in between shards creation and activation";
  }

  const activate = isTrueValue(args["activate"] ?? "");
  if (activate === undefined) {
    throw "Please provide --activate=yes or --activate=no";
  }

  await allocate({ dsn: dsns[0], from, to, migrateCmd, activate });

  return true;
}
