# Architecture

This document explains how ToatCloud Terminal works under the hood, from the CLI to the browser.

## Overview

ToatCloud Terminal uses GitHub Actions runners as ephemeral compute. When you boot a VM, the CLI dispatches a GitHub Actions workflow. The runner starts a Docker container with your chosen OS, exposes its shell via `ttyd`, and tunnels the connection to the public internet with `cloudflared`. You connect with a browser.

## How It Works

```
  toatcloud-terminal -init
        │
        ▼
  GitHub Actions runner (ubuntu-latest, Docker)
        │
        ├─ docker run <OS> + create user + mount cached home
        ├─ ttyd → shell over WebSocket
        └─ cloudflared tunnel → *.trycloudflare.com
        │
        ▼
  Browser terminal (xterm.js + WebSocket)
```

### Step-by-step flow

1. **CLI dispatches workflow** — The CLI sends a `workflow_dispatch` event to your GitHub repository via the GitHub API. The dispatch includes inputs such as OS image, username, password, cycle length, environment variables, pre/post-run scripts, resource limits, and port forwards.

2. **Runner boots Docker container** — A GitHub-hosted `ubuntu-latest` runner receives the event. It starts a Docker container with the chosen OS image, applying CPU, memory, and disk limits. A user account is created inside the container, and a cached home directory is mounted.

3. **Shell is exposed via ttyd** — `ttyd` is launched inside the container, running the user's shell. It listens on port 7681 inside the container. If a share password is set, ttyd uses basic auth.

4. **Tunnel is created with cloudflared** — `cloudflared` creates a tunnel from the runner's localhost:7681 to a public `*.trycloudflare.com` URL. The CLI reads the URL from the runner's job logs.

5. **CLI returns URL and credentials** — The CLI polls the run's job logs, extracts the tunnel URL and credentials using regular expressions, and prints them to the console.

6. **Browser connects** — You open the URL in any modern browser. The web client connects to ttyd via WebSocket and renders a terminal using `xterm.js`.

7. **Cycle and restart** — The workflow runs for the configured cycle length (default 60 minutes). It polls the `VM_STOP` repo variable. If the variable is not set and the cycle expires, the workflow saves the container's home directory cache and re-dispatches itself with the same inputs. This gives you an effectively persistent session with ~1h cycles and ~6h total lifetime per runner.

8. **Graceful stop** — When you run `-stop`, the CLI sets the `VM_STOP` variable. The workflow detects it, runs the post-run script, saves the cache, and exits without re-dispatching.

## Data Flow

```
+-------------------+     workflow_dispatch      +------------------------+
|   toatcloud-      | -------------------------> |  GitHub Actions        |
|   terminal CLI    |                            |  Runner (ubuntu-latest) |
+-------------------+                            +------------------------+
        |                                                 |
        |  GitHub API (listRuns,                          |  docker run <OS>
        |  dispatchWorkflow,                             |  ttyd on :7681
        |  setVariable, getVariable)                     |  cloudflared tunnel
        |                                                 |  cache save/restore
        |  <--- Poll logs for URL/creds --------------->  |
        |                                                 |
        v                                                 v
+-------------------+                            +------------------------+
|   Browser client   | <--- WebSocket over -----> |  ttyd inside Docker    |
|   (xterm.js)       |    cloudflared tunnel      |  container shell       |
+-------------------+                            +------------------------+
```

## Component Descriptions

### CLI (`cli/`)

- **Language:** TypeScript
- **Entry point:** `src/index.ts`
- **Responsibilities:**
  - Parse commands and flags
  - Manage local accounts and templates via `~/.config/toatvm/`
  - Dispatch and monitor GitHub Actions workflows via the GitHub REST API
  - Read job logs to extract tunnel URLs and credentials
  - Interact with the live VM over ttyd's WebSocket (for `-sync` and `-exec`)

### Lite CLI (`cli-lite/`)

- **Language:** TypeScript
- **Entry point:** `src/index.ts`
- **Responsibilities:**
  - Minimal web-focused interface
  - Boot sessions and retrieve live URLs
  - Lighter dependency footprint than the full CLI

### Web Client (`site/`)

- **Language:** React + Vite + TypeScript
- **Responsibilities:**
  - Render the browser-based terminal using `xterm.js`
  - Connect to ttyd over WebSocket
  - Provide account management UI
  - Serve as the documentation site

### Backend Workflows

| File | Purpose |
| --- | --- |
| `.github/workflows/vm.yml` | Terminal VM: Docker OS + user + ttyd + tunnel |
| `.github/workflows/vm-desktop.yml` | Desktop VM: XFCE + TigerVNC + noVNC + tunnel |

- **Terminal VM (`vm.yml`):**
  - Boots a Docker container with the chosen OS
  - Creates a user account and sets a password
  - Starts `ttyd` with optional basic auth
  - Starts `cloudflared` to expose the tunnel
  - Polls `VM_STOP` repo variable
  - Saves `vm-state/` to GitHub Actions cache
  - Re-dispatches itself on cycle expiry

- **Desktop VM (`vm-desktop.yml`):**
  - Boots a Docker container with Ubuntu
  - Installs XFCE, TigerVNC, and noVNC
  - Starts a VNC server on display `:1`
  - Serves noVNC via `websockify` on port 6080
  - Tunnels with `cloudflared`
  - Same cache and re-dispatch cycle as the terminal workflow

### GitHub API Layer (`cli/src/api.ts`)

- Wraps the GitHub REST API for:
  - Listing and dispatching workflow runs
  - Canceling runs
  - Setting, getting, and deleting repository variables
  - Fetching run logs and health status

### State and Cache

- **Local config:** `~/.config/toatvm/config.json` stores accounts, active account ID, and templates.
- **Runner cache:** GitHub Actions cache stores `vm-state/` (the Docker container's mounted home directory) keyed by `github.run_id`.
- **Repo variables:** `VM_STOP`, `VM_URL`, `VM_LABEL`, `VM_PASS`, and `VM_ENV_*` are used to coordinate state between the CLI and the runner.

## Session Lifecycle

```
  Boot
   │
   ▼
  Running (ttyd + cloudflared active)
   │
   ├─── Cycle expires (default 60 min)
   │        │
   │        ▼
   │    Cache save
   │        │
   │        ▼
   │    Re-dispatch new run
   │        │
   │        ▼
   │    Cache restore + boot again
   │
   └─── -stop / VM_STOP set
            │
            ▼
        Post-run script
            │
            ▼
        Cache save
            │
            ▼
        Exit (no re-dispatch)
```

## Security Notes

- Runners are public-ish; the tunnel URL is the only protection.
- Do not expose secrets. The shell account password is printed in the (public, for public repos) Actions logs.
- Runners are ephemeral. Use this for temporary development and testing, not for permanent or production workloads.
