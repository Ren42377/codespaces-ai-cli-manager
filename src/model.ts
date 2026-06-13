export type CliId = "antigravity" | "openclaude" | "opencode";

export interface CliDefinition {
  id: CliId;
  label: string;
  executable: string;
  installCommand: string;
  installPath: string;
}

export interface CliStatus {
  definition: CliDefinition;
  installed: boolean;
  version?: string;
  error?: string;
}

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(command: string, args: readonly string[], env: NodeJS.ProcessEnv): Promise<CommandResult>;
}

export interface StateStore {
  getNumber(key: string): number | undefined;
  setNumber(key: string, value: number): Promise<void>;
}
