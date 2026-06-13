#!/usr/bin/env bash
set -euo pipefail

repository="Ren42377/codespaces-ai-cli-manager"
asset="codespaces-ai-cli-manager.vsix"
download_url="https://github.com/${repository}/releases/latest/download/${asset}"
temporary_directory="$(mktemp -d)"
vsix_path="${temporary_directory}/${asset}"

cleanup() {
  rm -rf "$temporary_directory"
}

trap cleanup EXIT

if [[ "${CODESPACES:-}" != "true" ]]; then
  echo "This installer is intended for GitHub Codespaces." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 1
fi

code_server=""
if [[ -n "${VSCODE_CWD:-}" && -x "${VSCODE_CWD}/bin/code-server" ]]; then
  code_server="${VSCODE_CWD}/bin/code-server"
else
  code_server="$(find /vscode/bin/linux-x64 -path '*/bin/code-server' -type f -executable 2>/dev/null | sort | tail -n 1)"
fi

if [[ -z "$code_server" ]]; then
  echo "The VS Code server CLI could not be found." >&2
  exit 1
fi

echo "Downloading Codespaces AI CLI Manager..."
curl -fL "$download_url" -o "$vsix_path"

echo "Installing the extension in the Codespaces extension host..."
agent_directory="$HOME/.vscode-remote"
mkdir -p "$agent_directory/extensions" "$agent_directory/data"
VSCODE_AGENT_FOLDER="$agent_directory" "$code_server" \
  --extensions-dir "$agent_directory/extensions" \
  --user-data-dir "$agent_directory/data" \
  --install-extension "$vsix_path" \
  --force

echo "Codespaces AI CLI Manager is installed."
