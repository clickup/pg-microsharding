import { runShell } from "../runShell";

let stderr: string;

beforeEach(() => {
  stderr = "";
  jest.spyOn(process.stderr, "write").mockImplementation((v) => {
    stderr += v;
    return true;
  });
  process.stderr.setMaxListeners(1000);
  process.setMaxListeners(1000);
});

test("stderr is a part of error if fails", async () => {
  const cmd = "echo 'test stdout'; echo 'test' 'stderr' >&2; exit 1";
  const error = await runShell(cmd, null).catch((e) => e.message);
  expect(error).not.toMatch(/test stderr/);
  expect(stderr.trimEnd()).toEqual("test stderr");
});

test("stderr is printed if succeeds", async () => {
  const cmd = "echo 'test stdout'; echo 'test stderr' >&2; exit 0";
  const res = (await runShell(cmd, null)).join("\n");
  expect(res).toMatch(/test stdout/);
  expect(stderr.trimEnd()).toEqual("test stderr");
});
