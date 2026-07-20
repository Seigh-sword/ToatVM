<p align="center">
  <img src="../site/public/icon.svg" alt="ToatCloud Terminal" width="120" height="120" />
</p>

<p align="center">
  <strong>ToatCloud Terminal Documentation</strong>
</p>

<p align="center">
  <a href="https://github.com/Seigh-sword/ToatVM/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Seigh-sword/ToatVM/ci.yml?branch=main&style=flat-square"></a>
  <a href="https://www.npmjs.com/package/toatcloud-terminal"><img alt="npm" src="https://img.shields.io/npm/v/toatcloud-terminal?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/toatcloud-terminal-lite"><img alt="npm" src="https://img.shields.io/npm/v/toatcloud-terminal-lite?style=flat-square"></a>
  <a href="https://opensource.org/licenses/Apache-2.0"><img alt="License" src="https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square"></a>
  <a href="https://nodejs.org"><img alt="Node" src="https://img.shields.io/badge/Node-%3E%3D18-brightgreen?style=flat-square"></a>
</p>

---

## Welcome

ToatCloud Terminal is a terminal-in-your-browser powered by GitHub Actions runners. It boots a Docker container of your chosen OS on a runner, exposes a shell over a tunnel, and hands you a `*.trycloudflare.com` URL you can open in any browser.

This documentation covers installation, usage, architecture, and common questions.

## Documentation Sections

| Section | Description | Link |
| --- | --- | --- |
| Getting Started | Installation, quick start, and first boot | [getting-started.md](getting-started.md) |
| CLI Reference | Complete command and flag reference | [cli-reference.md](cli-reference.md) |
| Architecture | How the system works under the hood | [architecture.md](architecture.md) |
| FAQ | Frequently asked questions | [faq.md](faq.md) |

## Quick Navigation

- [Getting Started](getting-started.md) — install the CLI and boot your first VM
- [CLI Reference](cli-reference.md) — every command, flag, and example
- [Architecture](architecture.md) — data flow and component descriptions
- [FAQ](faq.md) — common issues and answers

## Packages

| Package | Description | Install |
| --- | --- | --- |
| `toatcloud-terminal` | Full terminal-focused CLI | `npm i -g toatcloud-terminal` |
| `toatcloud-terminal-lite` | Minimal web-focused CLI | `npm i -g toatcloud-terminal-lite` |

## Related Files

- [README.md](../README.md) — project overview
- [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) — community guidelines
- [SECURITY.md](../SECURITY.md) — security policy
- [TERMS.md](../TERMS.md) — terms of use
- [CHANGELOG.md](../CHANGELOG.md) — version history
- [CONTRIBUTORS.md](../CONTRIBUTORS.md) — how to contribute
- [AUTHORS.md](../AUTHORS.md) — project authors
- [SUPPORT.md](../SUPPORT.md) — getting help
- [DEVELOPER_PROMPT.md](../DEVELOPER_PROMPT.md) — comprehensive AI/developer guide
