import * as os from "node:os";
import * as path from "node:path";
import { CliDefinition } from "./model";

export const cliDefinitions: readonly CliDefinition[] = [
  {
    id: "antigravity",
    label: "Antigravity",
    executable: "agy",
    installCommand: "curl -fsSL https://antigravity.google/cli/install.sh | bash",
    installPath: path.join(os.homedir(), ".local", "bin")
  },
  {
    id: "openclaude",
    label: "OpenClaude",
    executable: "openclaude",
    installCommand: "npm install -g @gitlawb/openclaude@latest",
    installPath: path.join(os.homedir(), ".local", "bin")
  },
  {
    id: "opencode",
    label: "OpenCode",
    executable: "opencode",
    installCommand: "rm -f \"$HOME/.opencode/bin/opencode\" && npm install -g opencode-ai@latest",
    installPath: path.join(os.homedir(), ".opencode", "bin")
  }
];

export function isCodespace(environment: NodeJS.ProcessEnv, remoteName?: string): boolean {
  return environment.CODESPACES === "true" || remoteName === "codespaces";
}

export function managedPath(environment: NodeJS.ProcessEnv): string {
  const entries = [
    path.join(os.homedir(), ".local", "bin"),
    path.join(os.homedir(), ".opencode", "bin"),
    environment.PATH ?? ""
  ];
  return entries.filter(Boolean).join(path.delimiter);
}
