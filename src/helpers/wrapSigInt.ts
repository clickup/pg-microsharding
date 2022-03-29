import { log } from "./logging";

export default async function wrapSigInt<T>(
  func: (throwIfAborted: () => void) => Promise<T>
): Promise<T> {
  let aborted = false;

  const onSigInt = (): void => {
    log(
      "SIGINT received; aborting and cleaning up the half-migrated destination..."
    );
    aborted = true;
  };

  const throwIfAborted = (): void => {
    if (aborted) {
      throw "Aborted due to SIGINT.";
    }
  };

  process.on("SIGINT", onSigInt);
  try {
    return await func(throwIfAborted);
  } finally {
    process.off("SIGINT", onSigInt);
  }
}
