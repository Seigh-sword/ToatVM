# Getting Started

ToatCloud Terminal gives you a full Linux shell in your browser, powered by GitHub Actions runners. This guide walks you through installation, first boot, and troubleshooting.

## Prerequisites

- [Node.js](https://nodejs.org) 18 or later
- A GitHub account with access to a repository (public or private)
- A GitHub Personal Access Token (PAT) with `repo` and `workflow` scopes

## Installation

### Full CLI

Install the full terminal-focused CLI globally via npm:

```bash
npm i -g toatcloud-terminal
```

Verify the installation:

```bash
toatcloud-terminal -help
```

### Lite CLI

Install the minimal web-focused CLI globally via npm:

```bash
npm i -g toatcloud-terminal-lite
```

Verify the installation:

```bash
toatcloud-terminal-lite -help
```

### From source (web client)

```bash
git clone https://github.com/Seigh-sword/ToatVM.git
cd ToatVM/site
npm install
npm run dev
```

## Quick Start

### 1. Create an account

Save your GitHub account details locally:

```bash
toatcloud-terminal -new
```

You will be prompted for:
- Account name (any label you choose)
- GitHub owner (your username or organization)
- Repository (the repo where Actions runs will be created)
- Personal Access Token (must have `repo` and `workflow` scopes)

### 2. Boot a VM

Launch an interactive wizard to pick an OS and start a session:

```bash
toatcloud-terminal -init
```

The wizard prompts you for:
- Account (if you have multiple)
- Mode: Terminal (shell) or Desktop (XFCE GUI)
- OS image (Ubuntu, Debian, Arch, Alpine, Fedora, Kali)
- Username and password
- Cycle length (minutes before auto-restart)
- Optional environment variables, pre/post-run scripts, ports, and resource limits

### 3. Open the URL

Once the VM is live, the CLI prints a `*.trycloudflare.com` URL. Open it in any browser to access your terminal.

```bash
toatcloud-terminal -open
```

## First Boot Walkthrough

1. Run `toatcloud-terminal -init`.
2. Select your saved account.
3. Choose **Terminal** mode.
4. Pick an OS image (e.g., `ubuntu:latest`).
5. Enter a username (default `toat`) and password (leave blank for random).
6. Confirm the boot.
7. Wait for the "Booting..." spinner to finish (typically 30-90 seconds).
8. The CLI prints the live URL and credentials.
9. Open the URL in your browser.
10. Log in with the displayed credentials if prompted.

Your session runs for the cycle length (default 60 minutes). When the cycle ends, state is cached and a new run starts automatically. Use `-stop` to end the session gracefully.

## Common Commands

| Command | Description |
| --- | --- |
| `toatcloud-terminal -new` | Create a new saved account |
| `toatcloud-terminal -auth` | Update the PAT for an existing account |
| `toatcloud-terminal -accounts` | List all saved accounts |
| `toatcloud-terminal -select <name>` | Set the active account |
| `toatcloud-terminal -init` | Interactive boot wizard |
| `toatcloud-terminal -status` | Show the live session URL and credentials |
| `toatcloud-terminal -url --copy` | Copy the live URL to clipboard |
| `toatcloud-terminal -logs` | Stream the active run's job logs |
| `toatcloud-terminal -stop` | Gracefully stop the session (caches state) |
| `toatcloud-terminal -kill` | Immediately cancel the active run |
| `toatcloud-terminal -open` | Open the live URL in your default browser |
| `toatcloud-terminal -ssh` | Print an SSH command pre-filled with VM credentials |

## Non-interactive Boot

Boot a VM without the interactive wizard:

```bash
toatcloud-terminal -boot \
  --account myaccount \
  --mode t \
  --os ubuntu:latest \
  --user toat \
  --pass mypassword \
  --cycle 60 \
  --name "my-session" \
  --cpu 1 \
  --mem 2 \
  --disk 10
```

## Session Templates

Save a session configuration for repeated use:

```bash
toatcloud-terminal -template save dev-ubuntu
toatcloud-terminal -template apply dev-ubuntu
```

## Troubleshooting

### "No accounts yet -- run '-new' first"

You have not saved a GitHub account yet. Run `toatcloud-terminal -new` and follow the prompts.

### "dispatch failed (401/403)"

Your PAT is invalid or missing required scopes. Generate a new token with `repo` and `workflow` scopes, then run `toatcloud-terminal -auth` to update it.

### "Could not find the tunnel URL in time"

The runner failed to establish the tunnel within the timeout. Check the Actions tab in your repository for errors. Common causes:
- Runner availability issues
- Docker pull rate limits
- Cloudflared connectivity problems

### "No live session right now"

No VM is currently running. Boot one with `toatcloud-terminal -init` or `-boot`.

### "Could not establish tunnel"

The `cloudflared` tunnel could not be created. Try booting again. If the problem persists, check network restrictions or try a different OS image.

### CLI says "Windows detected" on macOS or Linux

This message only appears on Windows. If you see it unexpectedly, your platform detection may be incorrect. Ensure you are running the CLI on the intended OS.

### State not persisting across restarts

Files in `$HOME` should persist because the `vm-state` directory is cached by GitHub Actions. If state is lost:
- Verify the cache key is stable (it uses `github.run_id`).
- Check that the cache step completed successfully in the Actions log.

### Port forwards not working

Port forwards are passed as workflow inputs. Ensure you are using a template that includes the `--ports` flag, or boot with `-boot --ports 8080:80,3000:3000`.
