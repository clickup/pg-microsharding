import type { ParsedArgs } from "minimist";
import prompts from "prompts";
import { cleanup } from "../api/cleanup";
import { print } from "../internal/logging";
import { dsnShort } from "../internal/names";
import { normalizeDsns } from "../internal/normalizeDsns";

/**
 * Removes previously moved schema originals from the source database.
 */
export async function actionCleanup(args: ParsedArgs): Promise<boolean> {
  const dsns = await normalizeDsns(args["dsns"] || args["dsn"]);
  if (dsns.length === 0) {
    throw "Please provide --dsn or --dsns, DB DSNs to remove old schemas from";
  }

  for (const dsn of dsns) {
    print(`Cleaning up ${dsnShort(dsn)}...`);
    await cleanup({
      dsn,
      noOldShards: async (oldSchemaNameRe) =>
        print(`No old shard schemas matching regexp ${oldSchemaNameRe}`),
      confirm: async (schemas) => {
        const response = await prompts({
          type: "text",
          name: "value",
          message: `Delete redundant schemas ${schemas.join(", ")} (y/n)?`,
          validate: (value: string) =>
            value !== "y" && value !== "n" ? 'Enter "y" or "n".' : true,
        });
        return response.value === "y";
      },
    });
  }

  return true;
}
