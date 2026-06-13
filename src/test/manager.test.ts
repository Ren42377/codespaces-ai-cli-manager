import assert from "node:assert/strict";
import test from "node:test";
import { CliManager, updateIntervalMs } from "../manager";
import { CliDefinition, CommandResult, CommandRunner, StateStore } from "../model";

const definition: CliDefinition = {
  id: "opencode",
  label: "OpenCode",
  executable: "opencode",
  installCommand: "install-opencode",
  installPath: "/tmp/bin"
};

class MemoryState implements StateStore {
  readonly values = new Map<string, number>();

  getNumber(key: string): number | undefined {
    return this.values.get(key);
  }

  async setNumber(key: string, value: number): Promise<void> {
    this.values.set(key, value);
  }
}

class MockRunner implements CommandRunner {
  readonly calls: Array<{ command: string; args: readonly string[] }> = [];
  responses: CommandResult[] = [];

  async run(command: string, args: readonly string[]): Promise<CommandResult> {
    this.calls.push({ command, args });
    const response = this.responses.shift();
    if (!response) {
      throw new Error("No mock response");
    }
    return response;
  }
}

const success = (stdout = ""): CommandResult => ({
  code: 0,
  stdout,
  stderr: ""
});

const missing = (): CommandResult => ({
  code: 1,
  stdout: "",
  stderr: ""
});

function createManager(runner: MockRunner, state = new MemoryState(), now = 100_000): CliManager {
  return new CliManager(
    [definition],
    runner,
    state,
    {
      info: () => undefined,
      state: () => undefined
    },
    { PATH: "/usr/bin" },
    () => now
  );
}

test("reports installed version", async () => {
  const runner = new MockRunner();
  runner.responses.push(success("1.2.3\n"));
  const statuses = await createManager(runner).status();
  assert.equal(statuses[0].installed, true);
  assert.equal(statuses[0].version, "1.2.3");
  assert.deepEqual(runner.calls[0].args.slice(0, 1), ["-c"]);
});

test("reports a missing command", async () => {
  const runner = new MockRunner();
  runner.responses.push(missing());
  const statuses = await createManager(runner).status();
  assert.equal(statuses[0].installed, false);
});

test("installs a missing CLI even inside the daily interval", async () => {
  const runner = new MockRunner();
  const state = new MemoryState();
  state.values.set("lastSuccessfulUpdate", 99_999);
  runner.responses.push(missing(), success(), success("2.0.0\n"));
  const updated = await createManager(runner, state).runScheduledUpdate();
  assert.equal(updated, true);
  assert.equal(runner.calls.length, 3);
  assert.deepEqual(runner.calls[1].args, ["-c", "install-opencode"]);
});

test("skips a recent successful update when all CLIs exist", async () => {
  const runner = new MockRunner();
  const state = new MemoryState();
  state.values.set("lastSuccessfulUpdate", 99_999);
  runner.responses.push(success("2.0.0\n"));
  const updated = await createManager(runner, state).runScheduledUpdate();
  assert.equal(updated, false);
  assert.equal(runner.calls.length, 1);
});

test("updates after the daily interval", async () => {
  const now = updateIntervalMs + 100_000;
  const runner = new MockRunner();
  const state = new MemoryState();
  state.values.set("lastSuccessfulUpdate", 1);
  runner.responses.push(success("1.0.0\n"), success(), success("2.0.0\n"));
  const updated = await createManager(runner, state, now).runScheduledUpdate();
  assert.equal(updated, true);
});

test("does not record a failed update", async () => {
  const runner = new MockRunner();
  const state = new MemoryState();
  runner.responses.push({
    code: 9,
    stdout: "",
    stderr: "failed"
  });
  await assert.rejects(createManager(runner, state).updateAll(), /exited with code 9/);
  assert.equal(state.getNumber("lastSuccessfulUpdate"), undefined);
});

test("deduplicates concurrent update requests", async () => {
  let release: (() => void) | undefined;
  const runner: CommandRunner = {
    run: async (_command, args) => {
      if (args.includes("install-opencode")) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return success();
      }
      return success("2.0.0\n");
    }
  };
  const manager = new CliManager(
    [definition],
    runner,
    new MemoryState(),
    {
      info: () => undefined,
      state: () => undefined
    },
    { PATH: "/usr/bin" }
  );
  const first = manager.updateAll();
  const second = manager.updateAll();
  assert.equal(first, second);
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(release);
  release();
  await first;
});
