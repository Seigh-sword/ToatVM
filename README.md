# ToatCloud Terminal

**A terminal in your browser, powered by GitHub Actions runners.**

ToatCloud Terminal uses GitHub Actions as compute: it boots a Docker container
of the OS you pick on a runner, exposes a shell over a tunnel, and hands you
a `*.trycloudflare.com` URL you can open in any browser. Each session lives up
to ~6h and auto-restarts every cycle from a cached state.

This repo contains:
- **Web client** (`site/`) — React + Vite + TypeScript terminal UI
- **CLI** (`cli/`) — terminal-focused CLI for power users
- **Backend** (`.github/workflows/`) — GitHub Actions workflows that run the VM

> **Experimental.** Runners are ephemeral and not private. Do not store
> anything sensitive. Not for permanent or production use.

---

## Install / Download

### npm (CLI)
```bash
npm i -g toatcloud-terminal
toatcloud-terminal -help
```

### npm (Lite)
```bash
npm i -g toatcloud-terminal-lite
toatcloud-terminal-lite -help
```

### From source (web client)
```bash
git clone https://github.com/Seigh-sword/ToatVM.git
cd ToatVM/site
npm install
npm run dev
```

Requires [Node.js](https://nodejs.org) 18+.

---

## Quick start

### Web
1. Open the site
2. Enter your GitHub repo and PAT
3. Click "Boot Terminal"
4. A live terminal appears in your browser

### CLI
```bash
toatcloud-terminal -new      # create an account (owner / repo / PAT)
toatcloud-terminal -init     # pick OS, boot, get the live URL
```

---

## How it works

```
 toatcloud-terminal -init  OR  web client
       │                    │
       ▼                    ▼
 GitHub Actions runner (ubuntu-latest, Docker)
       │
       ├─ docker run <OS> + create user + mount cached home
       ├─ ttyd → shell over WebSocket
       └─ cloudflared tunnel → *.trycloudflare.com
       │
       ▼
 Browser terminal (xterm.js + WebSocket)
```

The URL and credentials are read from the run's job logs. `VM_STOP` is a repo
variable the CLI sets to halt the loop; the runner polls it, caches state, and
exits — that's why `-stop` is graceful instead of a hard kill.

---

## Features

1. **Browser terminal** — full shell in any modern browser
2. **Multiple accounts** with switchable active profile
3. **OS choice**: Ubuntu, Debian, Arch, Alpine, Fedora, Kali (Docker)
4. **Graceful stop** — caches state then closes
5. **Live URL + credentials** printed and copyable
6. **Run logs streaming**
7. **Non-interactive boot** with full flag set
8. **Session status** at a glance
9. **Browser open** and **ssh command**
10. **Account management**: create, auth, list, remove
11. **Per-session labels**
12. **Cached home directory** persists files across the 1h cycle
13. **Windows-friendly** hints
14. **Config stored locally** at `~/.config/toatvm/config.json`
15. **Apache 2.0 licensed**, zero config files in the repo

---

## Documentation

- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — Community guidelines
- **[SECURITY.md](SECURITY.md)** — Security policy and vulnerability reporting
- **[TERMS.md](TERMS.md)** — Terms of use
- **[DEVELOPER_PROMPT.md](DEVELOPER_PROMPT.md)** — Comprehensive guide for AI/developers

---

## Backend (this repo)

| File | Purpose |
| --- | --- |
| `.github/workflows/vm.yml` | Terminal VM: Docker OS + user + ttyd + tunnel |
| `.github/workflows/vm-desktop.yml` | Desktop VM: XFCE + TigerVNC + noVNC + tunnel |
| `.github/workflows/ci.yml` | Build check |
| `cli/` | The `toatcloud-terminal` CLI (TypeScript, `@clack/prompts`) |
| `cli-lite/` | Minimal web-focused CLI |
| `site/` | React + Vite + TypeScript web client |

To self-host the backend, fork the repo, enable Actions, add a PAT with
`repo` + `workflow`, and point `toatcloud-terminal -new` at your fork.

---

## Testing

```bash
# Install CLI
npm i -g toatcloud-terminal
toatcloud-terminal -version
toatcloud-terminal -help

# Quick smoke test
toatcloud-terminal -new
toatcloud-terminal -init

# Test web client
cd site
npm install
npm run dev
```

Run through the core flows:
1. `toatcloud-terminal -new` → save an account
2. `toatcloud-terminal -init` → boot a terminal session, confirm URL appears
3. `toatcloud-terminal -status` → confirm live session details
4. `toatcloud-terminal -url --copy` → confirm clipboard gets the URL
5. `toatcloud-terminal -stop` → confirm graceful shutdown

If anything fails, check the Actions tab in your repo for runner logs.

---

## Limitations & warnings

- Runners are public-ish; the tunnel URL is the only protection. Don't expose
  secrets. The shell account password is printed in the (public, for public
  repos) Actions logs.
- ~6h hard cap per run; ~1h cycles with cache-and-restart.
- Not a replacement for a real VM/cloud host.
