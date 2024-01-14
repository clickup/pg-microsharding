import chalk from "chalk";
import minimist from "minimist";
import prompts from "prompts";
import cleanup from "./api/cleanup";
import move from "./api/move";
import rebalance from "./api/rebalance";
import { log } from "./internal/logging";
import shellQuote from "./internal/shellQuote";

export { cleanup, move, rebalance, shellQuote };

const USAGE = [
  "Usage:",
  "  pg-sharding move",
  "    --shard=N --from=DSN --to=DSN",
  "    [--activate-on-destination]",
  "    [--deactivate-script='SQL $1 SQL']",
  "  pg-sharding cleanup --dsn=DSN",
];

export async function main(argv: string[]): Promise<boolean> {
  const args = minimist(argv, {
    string: ["shard", "from", "to", "deactivate-script", "dsn"],
    boolean: ["activate-on-destination"],
  });

  if (args._[0] === "move") {
    let shard: number;
    if ((args["shard"] ?? "").match(/^(\d+)$/)) {
      shard = parseInt(args["shard"]);
    } else {
      throw "Please provide --shard, a numeric shard number to move";
    }

    let fromDsn: string;
    if ((args["from"] ?? "").match(/^\w+:\/\//)) {
      fromDsn = args["from"];
    } else {
      throw "Please provide --from, source DB DSN, as postgresql://user:pass@host/db?options";
    }

    let toDsn: string;
    if ((args["to"] ?? "").match(/^\w+:\/\//)) {
      toDsn = args["to"];
    } else {
      throw "Please provide --to, destination DB DSN, as postgresql://user:pass@host/db?options";
    }

    const activateOnDestination = !!args["activate-on-destination"];
    const deactivateScript = args["deactivate-script"] as string | undefined;

    await move({
      shard,
      fromDsn,
      toDsn,
      activateOnDestination,
      deactivateScript,
    });

    if (!activateOnDestination) {
      log(
        chalk.red(
          "\n" +
            "ATTENTION: the schema has been copied, but NOT activated on the destination.\n" +
            "So effectively, it was a dry-run, and the data still lives in the source DB.\n" +
            "\n" +
            "To activate the schema on the destination and deactivate on the source, run\n" +
            "the tool with --activate-on-destination flag.\n",
        ),
      );
    }

    return true;
  }

  if (args._[0] === "cleanup") {
    let dsn: string;
    if ((args["dsn"] ?? "").match(/^\w+:\/\//)) {
      dsn = args["dsn"];
    } else {
      throw "Please provide --dsn, DB DSN to remove old schemas from, as postgresql://user:pass@host/db?options";
    }

    await cleanup({
      dsn,
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

    return true;
  }

  log(USAGE.join("\n"));
  return false;
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((success) => process.exit(success ? 0 : 1))
    .catch((e) => {
      log(chalk.red("" + e));
      process.exit(1);
    });
}
