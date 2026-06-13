import { spawn } from "node:child_process";
import { CommandResult, CommandRunner } from "./model";

export class NativeCommandRunner implements CommandRunner {
  run(command: string, args: readonly string[], env: NodeJS.ProcessEnv): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [...args], {
        env,
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => {
        resolve({
          code: code ?? 1,
          stdout,
          stderr
        });
      });
    });
  }
}
