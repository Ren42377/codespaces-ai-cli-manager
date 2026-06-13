import * as fs from "node:fs/promises";
import * as path from "node:path";
import { CliDefinition, CliId, CliStatus, CommandRunner, StateStore } from "./model";
import { managedPath } from "./platform";

const lastSuccessfulUpdateKey = "lastSuccessfulUpdate";
export const updateIntervalMs = 24 * 60 * 60 * 1000;

export interface ManagerEvents {
  info(message: string): void;
  state(message: string): void;
}

export class CliManager {
  private operation: Promise<void> | undefined;

  constructor(
    private readonly definitions: readonly CliDefinition[],
    private readonly runner: CommandRunner,
    private readonly stateStore: StateStore,
    private readonly events: ManagerEvents,
    private readonly environment: NodeJS.ProcessEnv = process.env,
    private readonly now: () => number = Date.now
  ) {}

  get terminalEnvironment(): NodeJS.ProcessEnv {
    return {
      ...this.environment,
      PATH: managedPath(this.environment)
    };
  }

  async status(): Promise<CliStatus[]> {
    return Promise.all(this.definitions.map((definition) => this.getStatus(definition)));
  }

  async runScheduledUpdate(): Promise<boolean> {
    const statuses = await this.status();
    const hasMissingCli = statuses.some((status) => !status.installed);
    const lastUpdate = this.stateStore.getNumber(lastSuccessfulUpdateKey) ?? 0;
    if (!hasMissingCli && this.now() - lastUpdate < updateIntervalMs) {
      this.events.info("Automatic update skipped because the last successful update was less than 24 hours ago.");
      return false;
    }
    await this.updateAll();
    return true;
  }

  updateAll(): Promise<void> {
    return this.withLock(async () => {
      this.events.state("Updating CLI tools");
      for (const definition of this.definitions) {
        await this.install(definition, false);
      }
      await this.stateStore.setNumber(lastSuccessfulUpdateKey, this.now());
      this.events.state("CLI tools are ready");
    });
  }

  reinstall(id: CliId): Promise<void> {
    return this.withLock(async () => {
      const definition = this.requireDefinition(id);
      this.events.state(`Reinstalling ${definition.label}`);
      await this.removeManagedBinary(definition);
      await this.install(definition, true);
      this.events.state(`${definition.label} is ready`);
    });
  }

  private withLock(action: () => Promise<void>): Promise<void> {
    if (this.operation) {
      this.events.info("An install or update is already running. Waiting for it to finish.");
      return this.operation;
    }
    const operation = action().finally(() => {
      if (this.operation === operation) {
        this.operation = undefined;
      }
    });
    this.operation = operation;
    return operation;
  }

  private async getStatus(definition: CliDefinition): Promise<CliStatus> {
    try {
      const result = await this.runner.run(
        "bash",
        ["-lc", `command -v ${definition.executable} >/dev/null 2>&1 && ${definition.executable} --version`],
        this.terminalEnvironment
      );
      if (result.code !== 0) {
        return {
          definition,
          installed: false
        };
      }
      return {
        definition,
        installed: true,
        version: result.stdout.trim().split(/\r?\n/, 1)[0] || "installed"
      };
    } catch (error) {
      return {
        definition,
        installed: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async install(definition: CliDefinition, reinstall: boolean): Promise<void> {
    this.events.info(`${reinstall ? "Reinstalling" : "Installing or updating"} ${definition.label}.`);
    const result = await this.runner.run(
      "bash",
      ["-lc", definition.installCommand],
      this.terminalEnvironment
    );
    if (result.code !== 0) {
      throw new Error(`${definition.label} installer exited with code ${result.code}.`);
    }
    const status = await this.getStatus(definition);
    if (!status.installed) {
      throw new Error(`${definition.label} installer completed but '${definition.executable}' was not found.`);
    }
    this.events.info(`${definition.label} is available: ${status.version ?? "installed"}.`);
  }

  private async removeManagedBinary(definition: CliDefinition): Promise<void> {
    const binaryPath = path.join(definition.installPath, definition.executable);
    try {
      await fs.rm(binaryPath, { force: true });
    } catch (error) {
      throw new Error(`Could not remove ${binaryPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private requireDefinition(id: CliId): CliDefinition {
    const definition = this.definitions.find((candidate) => candidate.id === id);
    if (!definition) {
      throw new Error(`Unknown CLI: ${id}`);
    }
    return definition;
  }
}
