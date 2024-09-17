import { exec } from "child_process";
import chalk from "chalk";
import compact from "lodash/compact";
import { log } from "./logging";

/**
 * Runs a shell command passing it an optional input as stdin. Throws on errors.
 * Returns the lines of stdout.
 */
export async function runShell(
  cmd: string,
  input: string | null,
  comment?: string,
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
    return await new Promise((resolve, reject) => {
      const child = exec(
        `set -o pipefail; ${cmd}`,
        {
          shell: "/bin/bash",
          env: {
            ...process.env,
            PGOPTIONS: compact([
              "--client-min-messages=warning",
              process.env["PGOPTIONS"],
            ]).join(" "),
          },
        },
        (error, stdout, stderr) => {
          if (error) {
            // Error's message already includes stderr as message suffix, so we
            // remove it, since we anyways pass stderr through.
            if (typeof error?.message === "string") {
              error.message = error.message.trimEnd();
              stderr = stderr.trimEnd();
              if (error.message.endsWith(stderr)) {
                error.message = error.message
                  .slice(0, -stderr.length)
                  .trimEnd();
              }
            }

            reject(error);
          } else {
            resolve(
              compact(
                stdout
                  .toString()
                  .split("\n")
                  .map((line) => line.trim()),
              ),
            );
          }
        },
      );
      child.stderr?.pipe(process.stderr);
      if (input && child.stdin) {
        child.stdin.write(input);
        child.stdin.end();
      }
    });
  } finally {
    process.removeListener("SIGINT", noop);
  }
}
