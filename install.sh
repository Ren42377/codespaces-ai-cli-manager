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

remote_cli=""
if [[ -n "${VSCODE_CWD:-}" && -x "${VSCODE_CWD}/bin/remote-cli/code" ]]; then
  remote_cli="${VSCODE_CWD}/bin/remote-cli/code"
elif command -v code >/dev/null 2>&1 && code --version >/dev/null 2>&1; then
  remote_cli="$(command -v code)"
else
  remote_cli="$(find /vscode/bin/linux-x64 -path '*/bin/remote-cli/code' -type f -executable 2>/dev/null | sort | tail -n 1)"
fi

if [[ -z "$remote_cli" ]]; then
  echo "The VS Code remote CLI could not be found." >&2
  exit 1
fi

echo "Downloading Codespaces AI CLI Manager..."
curl -fL "$download_url" -o "$vsix_path"

echo "Installing the extension in the Codespaces extension host..."
"$remote_cli" --install-extension "$vsix_path" --force

echo "Codespaces AI CLI Manager is installed."
