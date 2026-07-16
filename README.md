# 🐸 ToatVM

**A virtual machine that runs inside GitHub Actions runners — driven entirely
from your terminal.**

ToatVM uses GitHub Actions as compute: it boots a Docker container of the OS
you pick on a runner, exposes a shell (or full XFCE desktop) over a tunnel, and
hands you a `*.trycloudflare.com` URL you can open in any browser or terminal.
Each session lives up to ~6h and auto-restarts every cycle from a cached
state. This repo is the **CLI** (`toatvm`) plus the **GitHub Actions backend**
that does the actual work.

> ⚠ **Experimental.** Runners are ephemeral and not private. Do not store
> anything sensitive. Not for permanent or production use.

---

## Install / Download

### npm (recommended)
```bash
npm i -g toatvm
toatvm -help
```
Requires [Node.js](https://nodejs.org) 18+.

### npx (no install)
```bash
npx toatvm -init
```

### From source
```bash
git clone https://github.com/Seigh-sword/ToatVM.git
cd ToatVM/cli
npm install
npm run build
node dist/index.js -help
```

### Windows 10 / 11
Works natively. After booting, use `toatvm -open` (opens the URL in your
default browser) or `toatvm -ssh` (prints an `ssh` command to paste into
**Windows Terminal** / PowerShell). The runner shell isn't an SSH server by
default, so `-ssh` gives you the command to adapt; the browser terminal works
out of the box.

---

## Quick start

```bash
toatvm -new      # create an account (owner / repo / PAT)
toatvm -init     # pick OS, boot, get the live URL + controls
```

`-init` is the interactive wizard: choose account → Terminal or Desktop → OS
(username/password/cycle) → confirm → it boots and prints the live URL, then
offers **Open in browser**, **Copy URL**, **ssh command**, and **Shut down
(cache, then stop)**.

---

## Commands

| Command | What it does |
| --- | --- |
| `toatvm -init` | Interactive wizard: account, OS, boot, then live controls |
| `toatvm -new` | Create a saved account (name / owner / repo / token) |
| `toatvm -auth` | Save or update a token for an account |
| `toatvm -accounts` | List saved accounts |
| `toatvm -select <name>` | Set the active account |
| `toatvm -remove <name>` | Delete a saved account |
| `toatvm -list` | List recent workflow runs |
| `toatvm -status` | Show the live URL + credentials (if running) |
| `toatvm -url [--copy]` | Print (or copy) the live tunnel URL |
| `toatvm -logs` | Dump the active run's job logs |
| `toatvm -boot [flags]` | Boot non-interactively (see flags below) |
| `toatvm -stop` | Gracefully stop: cache state, then close |
| `toatvm -kill` | Immediately cancel the active run |
| `toatvm -open` | Open the live URL in your browser |
| `toatvm -ssh` | Print an ssh command pre-filled with VM creds |
| `toatvm -sync <dir>` | Info/hint for pushing local files into the VM |
| `toatvm -exec "<cmd>"` | Show how to run a command on the live VM |
| `toatvm -version` | Print version |
| `toatvm -license` | Print the MIT license |
| `toatvm -help` | Usage |

### `-boot` flags (and `-init` equivalents)
```
--account <name>   use this account
--mode <t|d>       terminal or desktop
--os <image>       ubuntu:latest | debian:latest | archlinux:latest |
                    alpine:latest | fedora:latest | kalilinux/kali-rolling
--user <name>      shell username (default toat)
--pass <pw>        shell password (random if blank)
--cycle <min>      minutes per cycle (default 60)
--name <label>     friendly session label
```
Example:
```bash
toatvm -boot --mode t --os archlinux:latest --user neo --cycle 120
```

---

## How it works

```
 toatvm -init
      │  workflow_dispatch (GitHub REST API, your PAT)
      ▼
 GitHub Actions runner (ubuntu-latest, Docker)
      ├─ docker run <OS> + create user + mount cached home
      ├─ ttyd  → shell over WebSocket   (Terminal mode)
      ├─ XFCE + TigerVNC + noVNC        (Desktop mode)
      └─ cloudflared tunnel → *.trycloudflare.com
      ▼
 you open the URL in a browser or terminal
```

The URL and credentials are read from the run's job logs (so no special token
permission is required). `VM_STOP` is a repo variable the CLI sets to halt the
loop; the runner polls it, caches state, and exits — that's why `-stop` is
graceful instead of a hard kill.

---

## Features

1. **Interactive TUI wizard** (`-init`) with ToatVM ASCII branding.
2. **Multiple accounts** with a switchable active profile (`-select`).
3. **OS choice**: Ubuntu, Debian, Arch, Alpine, Fedora, Kali (Docker).
4. **Terminal & Desktop** modes (shell or full XFCE GUI over noVNC).
5. **Graceful stop** — caches state then closes (`-stop`).
6. **Live URL + credentials** printed and copyable (`-url --copy`).
7. **Run logs streaming** (`-logs`).
8. **Non-interactive boot** with full flag set (`-boot`).
9. **Session status** at a glance (`-status`).
10. **Browser open** (`-open`) and **ssh command** (`-ssh`).
11. **Account management**: `-new`, `-auth`, `-accounts`, `-remove`.
12. **Per-session labels**.
13. **Cached home directory** persists files across the 1h cycle.
14. **Windows-friendly** hints (`-open` / `-ssh` for Windows Terminal).
15. **Provenance publishing** to npm on tagged releases.
16. **`--copy` clipboard** support (macOS / Linux / Windows).
17. **`--account` override** for any command.
18. **Config stored locally** at `~/.config/toatvm/config.json`.
19. **MIT licensed**, single-binary CLI, zero config files in the repo.
20. **Backend reuse** — same workflows power both modes and any number of accounts.
21. **Help / version / license** subcommands.
22. **`vm-state` cache + auto re-dispatch** loop (6h cap).

---

## Backend (this repo)

| File | Purpose |
| --- | --- |
| `.github/workflows/vm.yml` | Terminal VM: Docker OS + user + ttyd + tunnel |
| `.github/workflows/vm-desktop.yml` | Desktop VM: XFCE + TigerVNC + noVNC + tunnel |
| `.github/workflows/ci.yml` | Build check (proves `cli` builds) |
| `.github/workflows/publish.yml` | Publishes `cli/` to npm on `v*` tags |
| `cli/` | The `toatvm` CLI (TypeScript, `@clack/prompts`) |

To self-host the backend, fork the repo, enable Actions, add a PAT with
`repo` + `workflow`, and point `toatvm -new` at your fork.

---

## Limitations & warnings

- Runners are public-ish; the tunnel URL is the only protection. Don't expose
  secrets. The shell account password is printed in the (public, for public
  repos) Actions logs.
- ~6h hard cap per run; ~1h cycles with cache-and-restart.
- Not a replacement for a real VM/cloud host.
- The desktop GUI is reachable by anyone with the URL.
