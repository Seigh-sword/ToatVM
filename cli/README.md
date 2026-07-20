# toatcloud-terminal

<p align="center">
  <img src="https://img.shields.io/npm/v/toatcloud-terminal?style=flat-square" alt="npm version" />
  <img alt="License" src="https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square" />
  <img alt="Node" src="https://img.shields.io/badge/Node-%3E%3D18-brightgreen?style=flat-square" />
</p>

**ToatCloud Terminal CLI** - boot and manage Linux VMs inside GitHub Actions runners.

ToatCloud Terminal uses GitHub Actions as compute: it boots a Docker container
of the OS you pick on a runner, exposes a shell over a tunnel, and hands you
a `*.trycloudflare.com` URL you can open in any browser. Each session lives up
to ~6h and auto-restarts every cycle from a cached state.

> **Experimental.** Runners are ephemeral and not private. Do not store
> anything sensitive. Not for permanent or production use.

## Install

```bash
npm i -g toatcloud-terminal
toatcloud-terminal -help
```

Requires Node.js 18 or higher.

## Quick start

```bash
# Create an account
toatcloud-terminal -new

# Boot a terminal session
toatcloud-terminal -init

# Check status
toatcloud-terminal -status

# Stop gracefully
toatcloud-terminal -stop
```

## Commands

| Command | Description |
| --- | --- |
| `-init` | Interactive wizard: pick account, OS, boot, then control |
| `-new` | Create a new account (saved locally) |
| `-auth` | Save / update a token for an account |
| `-accounts` | List saved accounts |
| `-select <name>` | Set the active account |
| `-remove <name>` | Delete a saved account |
| `-list` | List recent workflow runs for the active account |
| `-status` | Show the current session (URL + credentials) if live |
| `-url [--copy]` | Print (or copy) the live tunnel URL |
| `-logs` | Stream the active run's job logs |
| `-boot` | Boot a VM non-interactively (flags below) |
| `-stop` | Gracefully stop the active session (cache, then close) |
| `-kill` | Immediately cancel the active run |
| `-open` | Open the live URL in your browser |
| `-ssh` | Print an ssh command pre-filled with the VM credentials |
| `-sync <dir>` | Upload a local folder into the VM ($HOME/sync) over the tunnel |
| `-share [pw]` | Password-protect the shared tunnel (ttyd basic auth) |
| `-unshare` | Remove the share password |
| `-exec "<cmd>"` | Run a command on the live VM over the tunnel |
| `-template` | Save, list, apply, or delete session templates |
| `-port` | Manage port forwards for the active session |
| `-env` | Manage environment variables for the next boot |
| `-health` | Check the health of the active or a recent run |
| `-history` | Show detailed session history with status |
| `-import <file>` | Import accounts from a JSON file |
| `-export [file]` | Export accounts to a JSON file |
| `-cleanup` | Clean up old workflow runs |
| `-version` | Print version |
| `-license` | Print the license |
| `-help` | Show this help |

### Global flags (for -boot / -init)

| Flag | Description |
| --- | --- |
| `--account <name>` | Use this account |
| `--mode <t|d>` | terminal or desktop |
| `--os <image>` | e.g. ubuntu:latest |
| `--user <name>` | shell username |
| `--pass <pw>` | shell password (random if blank) |
| `--cycle <min>` | minutes per cycle (default 60) |
| `--name <label>` | a friendly session name (stored locally) |
| `--env <json>` | environment variables as JSON object |
| `--pre-run <cmd>` | shell command to run inside VM on boot |
| `--post-run <cmd>` | shell command to run inside VM after cycle |
| `--ports <list>` | comma-separated host:container ports (e.g. 8080:80,3000:3000) |
| `--cpu <cores>` | CPU limit for the container |
| `--mem <gb>` | Memory limit for the container |
| `--disk <gb>` | Disk size for the container |

## How it works

```
  toatcloud-terminal -init
        │
        ▼
  GitHub Actions runner (ubuntu-latest, Docker)
        │
        ├─ docker run <OS> + create user + mount cached home
        ├─ ttyd -> shell over WebSocket
        └─ cloudflared tunnel -> *.trycloudflare.com
        │
        ▼
  Browser terminal (xterm.js + WebSocket)
```

The URL and credentials are read from the run's job logs. `VM_STOP` is a repo
variable the CLI sets to halt the loop; the runner polls it, caches state, and
exits - that's why `-stop` is graceful instead of a hard kill.

## Accounts and config

Accounts are stored at `~/.config/toatvm/config.json`.
The PAT needs `repo` + `workflow` scopes.
Templates are stored at `~/.config/toatvm/templates/`.

## Development

```bash
cd cli
npm install
npm run build
npm run start
```

## License

Apache 2.0 - see [LICENSE](../LICENSE)

## Contributing

See [CONTRIBUTORS.md](../.github/CONTRIBUTORS.md) for how to contribute.

See [AUTHORS.md](../.github/AUTHORS.md) for the list of authors and contributors.
