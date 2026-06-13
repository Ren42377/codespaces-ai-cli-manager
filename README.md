# Codespaces AI CLI Manager

Codespaces AI CLI Manager installs, updates, and launches these tools in the remote GitHub Codespaces environment:

- Google Antigravity CLI
- OpenClaude
- OpenCode

The extension runs as a workspace extension. It does not install tools on your local computer and does not collect or store API keys, login tokens, or provider credentials.

## Behavior

On activation in GitHub Codespaces, the extension checks whether the three CLIs are available. Missing tools are installed immediately. When all tools exist, automatic updates run at most once every 24 hours.

The official installation methods are used:

- Antigravity: `curl -fsSL https://antigravity.google/cli/install.sh | bash`
- OpenClaude: `npm install -g @gitlawb/openclaude@latest`
- OpenCode: `curl -fsSL https://opencode.ai/install | bash`

Antigravity's executable is named `agy`.

## Commands

- `AI CLI Manager: Check Status`
- `AI CLI Manager: Update All`
- `AI CLI Manager: Reinstall CLI`
- `AI CLI Manager: Open Antigravity`
- `AI CLI Manager: Open OpenClaude`
- `AI CLI Manager: Open OpenCode`

Use each tool's interactive onboarding or login flow after opening it. Store reusable API keys as GitHub Codespaces secrets when supported by the selected provider.

## Install From GitHub Release

Run this inside a Codespace:

```bash
curl -fsSL https://raw.githubusercontent.com/Ren42377/codespaces-ai-cli-manager/main/install.sh | bash
```

Reload the VS Code window after the first installation.

GitHub organization policy can restrict extension installation or network access.

## Install Automatically In New Codespaces

Add this command to the install script in your GitHub dotfiles repository:

```bash
curl -fsSL https://raw.githubusercontent.com/Ren42377/codespaces-ai-cli-manager/main/install.sh | bash
```

Enable the dotfiles repository under GitHub Settings, Codespaces. GitHub will run the dotfiles setup when it creates a new Codespace.

## Development

```bash
npm install
npm run check
npm test
npm run package
```

The local package includes its version in the filename. GitHub Releases publish it as `codespaces-ai-cli-manager.vsix` so the installer URL remains stable.

## Releasing

Update the version in `package.json`, commit the changes, and push a matching tag:

```bash
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

The GitHub Actions workflow type-checks, tests, packages the VSIX, and attaches it to the GitHub Release.

## Troubleshooting

Open `View: Toggle Output`, select `AI CLI Manager`, and run `AI CLI Manager: Check Status`.

The extension expects a Linux Codespace with `bash`, `curl`, Node.js, and npm. It adds `~/.local/bin` and `~/.opencode/bin` to terminals that it creates and to future extension-host terminal environments.
