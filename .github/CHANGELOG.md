# Changelog

All notable changes to ToatCloud Terminal are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-07-20

### Added
- React + Vite documentation site (`site/`) with in-page API proxy
- Lite CLI package (`cli-lite/`) for minimal web-focused usage
- Desktop VM workflow with XFCE desktop, TigerVNC, and noVNC
- Terminal/Desktop mode toggle in the web client
- Session labels for organizing multiple VM sessions
- Account creation, authentication, listing, and removal commands
- Password sharing (`-share` / `-unshare`) for tunnel HTTP basic auth
- Configurable username, password, and OS selection (Docker)
- CPU, memory, and disk resource limit configuration
- Health check endpoint for the VM runner
- Environment variable injection into VM sessions
- Graceful cache-then-stop shutdown via `VM_STOP` repo variable
- Live URL and credentials printed and copyable from CLI
- Session status display at a glance
- Windows-friendly hints and documentation
- npm publish workflow for `toatcloud-terminal` and `toatcloud-terminal-lite`
- CI build check workflow
- SECURITY.md, CODE_OF_CONDUCT.md, TERMS.md, and comprehensive developer prompt

### Changed
- Rebranded from ToatVM to ToatCloud Terminal
- Removed all emoji from project documentation and branding
- Migrated backend from Cloudflare Pages Functions to GitHub Actions workflows
- Improved error handling and user feedback in CLI with `@clack/prompts` v0.7
- Updated minimum Node.js requirement to 18
- Refined web client with xterm.js for browser terminal rendering

### Fixed
- Reliable start/stop flow using `VM_STOP` instead of variable write permissions
- URL reading from run logs instead of requiring variable write permissions
- Cloudflare Pages Functions catch-all route syntax (`[[path]]`)

## [0.2.0] - 2025-12-14

### Added
- Multiple GitHub account support with switchable active profile
- Session caching: home directory persists files across 1h cycle
- Non-interactive boot with full flag set
- Run logs streaming to the terminal client
- Browser open and SSH command output
- Cached state auto-restart on cycle expiration

### Changed
- Migrated web frontend from primary product to documentation site
- Made CLI the primary user-facing product with TUI
- Improved account management UX
- Updated documentation with developer prompt guide

### Fixed
- Missing `useEffect` opening in Terminal component (TS build fix)

## [0.1.0] - 2025-10-28

### Added
- Initial GitHub Actions-backed browser terminal
- Docker OS selection: Ubuntu, Debian, Arch, Alpine, Fedora, Kali
- ttyd shell over WebSocket with cloudflared tunnel
- `*.trycloudflare.com` live URL generation
- In-page proxy for web client
- Multi-account support with local config at `~/.config/toatvm/config.json`
- Desktop mode: XFCE + TigerVNC + noVNC with Terminal/Desktop toggle
- Graceful shutdown with cache preservation
- Apache 2.0 license

[0.3.0]: https://github.com/Seigh-sword/ToatVM/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Seigh-sword/ToatVM/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Seigh-sword/ToatVM/releases/tag/v0.1.0
