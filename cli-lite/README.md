# toatcloud-terminal-lite

<p align="center">
  <img src="https://img.shields.io/npm/v/toatcloud-terminal-lite?style=flat-square" alt="npm version" />
  <img alt="License" src="https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square" />
  <img alt="Node" src="https://img.shields.io/badge/Node-%3E%3D18-brightgreen?style=flat-square" />
</p>

**ToatCloud Terminal Lite** - minimal web-focused CLI for GitHub Actions VMs.

A lightweight companion to the main ToatCloud Terminal CLI, focused on web
workflows and quick boot operations.

> **Experimental.** Runners are ephemeral and not private. Do not store
> anything sensitive. Not for permanent or production use.

## Install

```bash
npm i -g toatcloud-terminal-lite
toatcloud-terminal-lite -help
```

Requires Node.js 18 or higher.

## Quick start

```bash
# Create an account
toatcloud-terminal-lite -new

# Boot a terminal session
toatcloud-terminal-lite -init
```

## Commands

| Command | Description |
| --- | --- |
| `-init` | Interactive wizard: pick account, OS, boot |
| `-new` | Create a new account (saved locally) |
| `-auth` | Save / update a token for an account |
| `-accounts` | List saved accounts |
| `-status` | Show the current session if live |
| `-url [--copy]` | Print (or copy) the live tunnel URL |
| `-boot` | Boot a VM non-interactively |
| `-stop` | Gracefully stop the active session |
| `-open` | Open the live URL in your browser |
| `-version` | Print version |
| `-help` | Show this help |

## How it works

ToatCloud Terminal Lite uses GitHub Actions as compute, same as the main CLI.
It boots a Docker container of the OS you pick on a runner, exposes a shell
over a tunnel, and hands you a `*.trycloudflare.com` URL.

## Development

```bash
cd cli-lite
npm install
npm run build
npm run start
```

## License

Apache 2.0 - see [LICENSE](../LICENSE)

## Contributing

See [CONTRIBUTORS.md](../.github/CONTRIBUTORS.md) for how to contribute.

See [AUTHORS.md](../.github/AUTHORS.md) for the list of authors and contributors.
