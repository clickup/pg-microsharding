import logUpdate from "log-update";

export const progress = logUpdate.create(process.stdout, { showCursor: true });

export function log(msg: string): void {
  const date = new Date()
    .toString()
    .replace(/ GMT.*/, "")
    .replace(/ \(.*/, "");
  progress.done();
  progress(msg.replace(/^/gm, `[${date}] `));
  progress.done();
}
