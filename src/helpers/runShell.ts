import { execSync } from "child_process";
import chalk from "chalk";
import compact from "lodash/compact";
import { log } from "./logging";

/**
 * Runs a shell command passing it an optional input as stdin. Throws on errors.
 * Returns the lines of stdout.
 */
export default async function runShell(
  cmd: string,
  input: string | null,
  comment?: string
): Promise<string[]> {
  if (comment) {
    log(chalk.greenBright(chalk.bold(comment)));
    input = input?.trim() ?? null;
    log(chalk.gray(`$ ${cmd}`));
    if (input) {
      log(chalk.gray(input.trim()));
    }
  }

  const noop = (): void => {};
  process.on("SIGINT", noop);
  try {
    return compact(
      execSync(`set -o pipefail; ${cmd}`, {
        shell: "/bin/bash",
        stdio: [undefined, undefined, "inherit"],
        input: input ?? undefined,
        env: {
          ...process.env,
          PGOPTIONS: compact([
            "--client-min-messages=warning",
            process.env["PGOPTIONS"],
          ]).join(" "),
        },
      })
        .toString()
        .split("\n")
        .map((line) => line.trim())
    );
  } finally {
    process.removeListener("SIGINT", noop);
  }
}
