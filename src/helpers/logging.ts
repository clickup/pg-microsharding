import logUpdate from "log-update";

export const progress = logUpdate.create(process.stdout, { showCursor: true });

export function log(msg: string): void {
  progress.done();
  progress(msg);
  progress.done();
}
