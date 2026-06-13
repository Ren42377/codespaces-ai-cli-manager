import * as path from "node:path";
import * as vscode from "vscode";
import { CliManager } from "./manager";
import { CliId, StateStore } from "./model";
import { cliDefinitions, isCodespace } from "./platform";
import { NativeCommandRunner } from "./processRunner";

class WorkspaceStateStore implements StateStore {
  constructor(private readonly state: vscode.Memento) {}

  getNumber(key: string): number | undefined {
    return this.state.get<number>(key);
  }

  async setNumber(key: string, value: number): Promise<void> {
    await this.state.update(key, value);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("AI CLI Manager");
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBar.command = "codespacesAiCliManager.checkStatus";
  statusBar.text = "$(tools) AI CLIs";
  statusBar.tooltip = "Check AI CLI status";
  statusBar.show();

  const codespace = isCodespace(process.env, vscode.env.remoteName);
  const manager = new CliManager(
    cliDefinitions,
    new NativeCommandRunner(),
    new WorkspaceStateStore(context.globalState),
    {
      info: (message) => {
        output.appendLine(`[${new Date().toISOString()}] ${message}`);
      },
      state: (message) => {
        statusBar.text = `$(tools) ${message}`;
        output.appendLine(`[${new Date().toISOString()}] ${message}`);
      }
    }
  );

  const pathEntries = [
    path.join(process.env.HOME ?? "", ".local", "bin"),
    path.join(process.env.HOME ?? "", ".opencode", "bin")
  ].filter((entry) => entry !== path.join("", ".local", "bin") && entry !== path.join("", ".opencode", "bin"));
  if (pathEntries.length > 0) {
    context.environmentVariableCollection.prepend("PATH", `${pathEntries.join(path.delimiter)}${path.delimiter}`);
  }

  const requireCodespace = async (action: () => Promise<void>): Promise<void> => {
    if (!codespace) {
      void vscode.window.showWarningMessage("AI CLI Manager only installs tools in GitHub Codespaces.");
      return;
    }
    try {
      await action();
    } catch (error) {
      statusBar.text = "$(error) AI CLI install failed";
      output.appendLine(`[${new Date().toISOString()}] ${error instanceof Error ? error.message : String(error)}`);
      output.show(true);
      void vscode.window.showErrorMessage("AI CLI Manager could not complete the operation. See the AI CLI Manager output.");
    }
  };

  const openCli = (id: CliId): void => {
    if (!codespace) {
      void vscode.window.showWarningMessage("AI CLI Manager launch commands are available in GitHub Codespaces.");
      return;
    }
    const definition = cliDefinitions.find((candidate) => candidate.id === id);
    if (!definition) {
      return;
    }
    const terminal = vscode.window.createTerminal({
      name: definition.label,
      env: {
        PATH: manager.terminalEnvironment.PATH
      }
    });
    terminal.show();
    terminal.sendText(definition.executable, true);
  };

  context.subscriptions.push(
    output,
    statusBar,
    vscode.commands.registerCommand("codespacesAiCliManager.checkStatus", async () => {
      await requireCodespace(async () => {
        statusBar.text = "$(sync~spin) Checking AI CLIs";
        const statuses = await manager.status();
        const summary = statuses
          .map((status) => `${status.definition.label}: ${status.installed ? status.version ?? "installed" : "missing"}`)
          .join(", ");
        statusBar.text = statuses.every((status) => status.installed)
          ? "$(check) AI CLIs ready"
          : "$(warning) AI CLIs missing";
        output.appendLine(`[${new Date().toISOString()}] ${summary}`);
        void vscode.window.showInformationMessage(summary);
      });
    }),
    vscode.commands.registerCommand("codespacesAiCliManager.updateAll", async () => {
      await requireCodespace(async () => {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Updating AI CLI tools",
            cancellable: false
          },
          async () => manager.updateAll()
        );
        void vscode.window.showInformationMessage("Antigravity, OpenClaude, and OpenCode are ready.");
      });
    }),
    vscode.commands.registerCommand("codespacesAiCliManager.reinstall", async () => {
      await requireCodespace(async () => {
        const selected = await vscode.window.showQuickPick(
          cliDefinitions.map((definition) => ({
            label: definition.label,
            description: definition.executable,
            id: definition.id
          })),
          {
            placeHolder: "Select a CLI to reinstall"
          }
        );
        if (!selected) {
          return;
        }
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Reinstalling ${selected.label}`,
            cancellable: false
          },
          async () => manager.reinstall(selected.id)
        );
        void vscode.window.showInformationMessage(`${selected.label} is ready.`);
      });
    }),
    vscode.commands.registerCommand("codespacesAiCliManager.openAntigravity", () => openCli("antigravity")),
    vscode.commands.registerCommand("codespacesAiCliManager.openOpenClaude", () => openCli("openclaude")),
    vscode.commands.registerCommand("codespacesAiCliManager.openOpenCode", () => openCli("opencode"))
  );

  if (!codespace) {
    statusBar.text = "$(circle-slash) AI CLIs: Codespaces only";
    output.appendLine("Automatic installation skipped because this is not a GitHub Codespace.");
    return;
  }

  void requireCodespace(async () => {
    statusBar.text = "$(sync~spin) Checking AI CLIs";
    const updated = await manager.runScheduledUpdate();
    if (!updated) {
      statusBar.text = "$(check) AI CLIs ready";
      return;
    }
    statusBar.text = "$(check) AI CLIs ready";
    void vscode.window.showInformationMessage("Antigravity, OpenClaude, and OpenCode are ready.");
  });
}

export function deactivate(): void {}
