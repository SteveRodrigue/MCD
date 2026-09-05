# Marvel Champions Digital (MCD) — Installation & Setup Guide

This guide provides comprehensive, step-by-step instructions for setting up, installing dependencies, configuring your environment, running, and verifying **Marvel Champions Digital (MCD)** across Windows, macOS, and Linux.

---

## 📋 System Requirements & Prerequisites

Before installing the project, verify that your development environment meets the following minimum requirements:

| Tool        | Minimum Version             | Recommended Version     | Purpose                                        |
| :---------- | :-------------------------- | :---------------------- | :--------------------------------------------- |
| **Node.js** | `>= 18.0.0`                 | `>= 20.x` or `22.x LTS` | JavaScript/TypeScript runtime                  |
| **npm**     | `>= 9.0.0`                  | `>= 10.x`               | Default package manager (bundled with Node.js) |
| **Git**     | `>= 2.30.0`                 | Latest                  | Source control & repository cloning            |
| **OS**      | Windows 10/11, macOS, Linux | Any modern 64-bit OS    | Cross-platform web & desktop target            |

---

## 🛠️ Step 1: Installing Node.js & npm

If running `node -v` or `npm -v` fails or produces an error such as:

```powershell
npm : The term 'npm' is not recognized as the name of a cmdlet, function, script file, or operable program.
```

you must install Node.js and ensure it is properly registered in your system `PATH`.

### Option A: Official Installer (Beginner / Recommended)

1. Visit the official Node.js download page: [https://nodejs.org/](https://nodejs.org/).
2. Download the **LTS (Long Term Support)** installer for your operating system.
3. Run the installer, ensuring the option **"Add to PATH"** is checked.
4. **Restart your terminal, PowerShell, or IDE** (e.g., VS Code / Antigravity) so new PATH environment variables take effect.

### Option B: Windows Package Managers

You can install Node.js via Windows terminal using `winget` or `chocolatey`:

```powershell
# Using Windows Package Manager (Winget)
winget install OpenJS.NodeJS.LTS

# Using Chocolatey
choco install nodejs-lts
```

### Option C: Node Version Managers (Advanced / Multi-Project)

Version managers allow switching between Node.js versions seamlessly:

- **Windows:** [nvm-windows](https://github.com/coreybutler/nvm-windows) or [fnm (Fast Node Manager)](https://github.com/Schniz/fnm):
  ```powershell
  # Using winget to install fnm
  winget install Schniz.fnm
  fnm install 20
  fnm use 20
  ```
- **macOS / Linux:** [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm):
  ```bash
  curl -fsSL https://fnm.vercel.app/install | bash
  fnm install 20
  fnm use 20
  ```

---

## 🔍 Step 2: Verifying Node.js & PATH Configuration

Open a **new** PowerShell, Command Prompt, or terminal window and execute:

```bash
node -v
npm -v
```

Both commands should output version numbers (e.g., `v20.18.0` and `10.8.2`).

### Troubleshooting Windows PATH & Execution Policy

#### 1. "The term 'npm' is not recognized"

If Node.js was newly installed while your terminal or IDE was already running, Windows applications retain their initial environment block. You can fix this permanently across all present and future PowerShell sessions:

**Automated One-Liner Fix (Permanently updates Registry & PowerShell Profiles):**

```powershell
# 1. Permanently add Node.js to your Windows User PATH in the Registry
$userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike '*C:\Program Files\nodejs*') {
    [System.Environment]::SetEnvironmentVariable('Path', "$userPath;C:\Program Files\nodejs", 'User')
}

# 2. Configure PowerShell Profile so Node.js and npm are always available in all terminal sessions
foreach ($dir in @("$HOME\Documents\WindowsPowerShell", "$HOME\Documents\PowerShell")) {
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    @'
if ($env:Path -notlike '*C:\Program Files\nodejs*') { $env:Path = "$env:Path;C:\Program Files\nodejs" }
if ($env:Path -notlike '*AppData\Roaming\npm*') { $env:Path = "$env:Path;$env:APPDATA\npm" }
'@ | Set-Content (Join-Path $dir 'profile.ps1') -Encoding UTF8
}
```

**Manual GUI Alternative:**

1. Press `Win + R`, type `sysdm.cpl`, and press Enter.
2. Navigate to **Advanced** tab -> **Environment Variables**.
3. Under **User variables** (or **System variables**), select `Path` and click **Edit**.
4. Ensure `C:\Program Files\nodejs\` and `%APPDATA%\npm` are listed.
5. Click **OK** to save and apply.

#### 2. "Running scripts is disabled on this system" (PSSecurityException)

When executing `npm` on Windows, PowerShell may attempt to run `C:\Program Files\nodejs\npm.ps1` and raise:

```
npm : Impossible de charger le fichier C:\Program Files\nodejs\npm.ps1, car l'exécution de scripts est désactivée sur ce système.
```

Resolve this for your user account by running:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

#### 3. GitHub Authentication & Agent Headless Interaction Setup

Automated AI coding assistants (such as Antigravity) execute terminal commands in non-interactive, headless subshells. If Git attempts to prompt for interactive input during operations like `git push`, `git fetch`, or `git pull`, the background process will hang indefinitely.

##### Why This Happens (The `helper-selector` Trap)

On some Windows environments (including GitPortable or fresh Git for Windows installations), the default credential helper is set to `helper-selector`. When remote operations require credentials, Git pauses and asks on standard input:

```
Select Git credential helper: [1] Git Credential Manager, [2] Windows Credential Store...
```

Because headless agent shells have no attached interactive TTY, the process blocks forever waiting for input.

##### Permanent Fix

1. **Set Git Credential Manager (`manager`) as your default credential helper:**

   ```bash
   git config --global credential.helper manager
   ```

   _Git Credential Manager handles GitHub browser OAuth login, Two-Factor Authentication (2FA), and stores your access token securely in the Windows Credential Store._

2. **Complete One-Time Interactive Authentication:**
   Open an interactive terminal (PowerShell, Windows Terminal, or VS Code terminal) and execute:
   ```bash
   git fetch origin
   ```
   If a prompt or browser dialog appears, select **`manager`** and click **Authorize**. Your token is now securely saved in Windows Credential Manager.

##### How to Verify the Agent Can Interact with GitHub

To confirm that automated agents and CI scripts can interact with GitHub non-interactively without getting stuck, run:

```bash
git ls-remote --exit-code origin
```

- **Success:** Outputs remote branch hashes (e.g. `<hash> refs/heads/main`) and exits immediately with code `0` without any prompts.
- **Blocked / Needs Attention:** If the command hangs or prompts for credentials, ensure `git config --global credential.helper` returns `manager` and complete the one-time interactive login.

---

## 📦 Step 3: Cloning & Installing Dependencies

1. **Clone the repository:**

   ```bash
   git clone https://github.com/SteveRodrigue/MCD.git
   cd MCD
   ```

2. **Install project dependencies:**

   ```bash
   npm install
   ```

3. _(Optional)_ **Cache Card Art Assets locally:**
   The project can fetch card images directly from MarvelCDB or cache them locally for offline / high-speed play:
   ```bash
   npm run cache:cards
   ```

---

## 🎮 Step 4: Running the Application

### Local Development Server

Launch the interactive React web application with Vite and Hot Module Replacement (HMR):

```bash
npm run dev
```

The application is pre-configured in `vite.config.ts` to run strictly on **`http://localhost:3000/`**. Open this link in Google Chrome, Mozilla Firefox, Microsoft Edge, or Apple Safari.

### Production Build & Preview

To compile the production-ready distribution bundle and test it locally:

```bash
# Build TypeScript and Vite bundle into dist/
npm run build

# Preview the built distribution bundle
npm run preview
```

### Headless Match Simulation

To run headless match simulations (benchmarks rules engine stability and AI playouts without rendering React UI):

```bash
npm run simulate
```

---

## 🧪 Step 5: Verification & Quality Suite

Marvel Champions Digital adheres strictly to Test-Driven Development (TDD) and type safety. Run the following commands to verify your setup:

| Command                       | Description                                                         |
| :---------------------------- | :------------------------------------------------------------------ |
| `npm run typecheck`           | Validates all TypeScript types (`tsc --noEmit`)                     |
| `npm test`                    | Runs the Vitest automated test suite once                           |
| `npm run test:watch`          | Runs Vitest in interactive watch mode during development            |
| `npm run test:coverage`       | Generates test coverage metrics across engine and UI                |
| `npm run lint`                | Lints codebase with ESLint (strict 0 warnings required)             |
| `npm run format:check`        | Checks code formatting against Prettier                             |
| `npm run format`              | Auto-formats code with Prettier                                     |
| `npm run report:declarations` | Audits declarative supplemental card definitions & schema adherence |

To execute the standard pre-commit verification pipeline in one sequence:

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run report:declarations
```

---

## 💻 Step 6: Recommended IDE Setup

For the best developer experience, we recommend **Visual Studio Code** or **Antigravity IDE** with the following workspace extensions:

- **ESLint** (`dbaeumer.vscode-eslint`): Real-time lint error highlighting.
- **Prettier - Code formatter** (`esbenp.prettier-vscode`): Automatic code formatting on save.
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`): Autocomplete for utility classes.
- **Vitest** (`vitest.explorer`): Interactive test runner and inline test results.

Settings are pre-configured in `.vscode/settings.json` and `.vscode/extensions.json`.

---

## ❓ Frequently Asked Questions (FAQ)

### Can I use pnpm or yarn instead of npm?

Yes. `pnpm install` / `pnpm dev` and `yarn` / `yarn dev` are fully supported. However, the repository locks dependencies via `package-lock.json`, so `npm` is the primary reference.

### What should I do if port 3000 is already in use?

The server is configured with `port: 3000, strictPort: true` in `vite.config.ts`. If port 3000 is occupied by another process, you can override the port via:

```bash
npm run dev -- --port 3001
```

### Where are card rules and scenario definitions stored?

- Universal state machines and rule mechanics: `src/engine/`
- Declarative supplemental card definitions: `src/data/supplemental/pack/*.json`
- Official card data: ingested from `marvelsdb-json-data` via `src/data/importer/`
