# DEVELOPER_PROMPT.md — ToatCloud Terminal

> **This file is a prompt for the next AI assistant.** It contains the complete
> project context, architecture decisions, current state, and explicit next
> steps. Read it before making any changes.

---

## 1. PROJECT IDENTITY

- **Name**: ToatCloud Terminal
- **Tagline**: A terminal in your browser, powered by GitHub Actions runners.
- **License**: Apache License, Version 2.0
- **Primary product**: Web client (`site/`) — a React + Vite + TypeScript app
  that displays an xterm.js terminal connected to a ttyd WebSocket backend.
- **Secondary product**: CLI (`cli/`) — terminal-focused CLI for power users.
- **Lite product**: `cli-lite/` — minimal web-focused CLI.
- **Backend**: `.github/workflows/vm.yml` — GitHub Actions workflow that boots a
  Docker container, runs ttyd, and tunnels via cloudflared.

---

## 2. VISION & GOALS

### Primary Goal
Users should be able to:
1. Open `toatcloud.pages.dev` (or the deployed site)
2. Enter their GitHub owner/repo and a PAT
3. Click "Boot Terminal"
4. See a live Linux shell in their browser within 30-60 seconds

### Secondary Goals
- Provide a CLI (`toatcloud-terminal`) for power users
- Support terminal and desktop modes
- Allow session templates, env vars, port forwards, resource limits
- Graceful stop with state caching
- Password-protected sharing

### Out of Scope (for now)
- npm publishing (removed `publish.yml`)
- Desktop mode in web client (terminal only for v1)
- Multi-user sessions
- Persistent storage beyond the 1h cycle

---

## 3. CURRENT STATE

### What Works
- **Backend workflow** (`.github/workflows/vm.yml`): boots Docker, runs ttyd,
  tunnels via cloudflared, caches state, re-dispatches. Solid and tested.
- **CLI** (`cli/`): full-featured, builds cleanly, can boot VMs, manage accounts.
- **Lite CLI** (`cli-lite/`): minimal, builds cleanly.
- **Web client scaffold** (`site/`): React + Vite + TypeScript + xterm.js.
  - `BootForm.tsx` — form to enter GitHub repo + PAT + OS
  - `Terminal.tsx` — xterm.js component ready to connect to WebSocket
  - `App.tsx` — home view + terminal view toggle
  - Builds cleanly (`npm run build` → `site/dist/`)

### What's Broken / Missing
- **No API proxy**: The React app cannot call GitHub API directly from the
  browser (CORS + token exposure). Needs a backend.
- **No WebSocket flow**: `Terminal.tsx` has the xterm.js setup but no real
  ttyd URL to connect to yet.
- **No deployment**: Site is not deployed anywhere.
- **No CI for site**: No workflow to build/deploy the React app.

---

## 4. ARCHITECTURE

```
User browser
    │
    ▼
React + Vite site (site/)
    │
    ├─ POST /api/boot     → Backend proxy (Express / CF Worker / Vite plugin)
    │   Body: { owner, repo, token, mode, image, username, cycle, ... }
    │   Returns: { url, creds, sharePass }
    │
    ├─ GET /api/status    → Backend proxy
    │   Returns: { url, creds, running }
    │
    ├─ POST /api/stop     → Backend proxy
    │   Body: { owner, repo, token, runId }
    │
    └─ WebSocket (direct) → {tunnelUrl}/websocket
        Binary protocol: type 0 = input/output, type 1 = resize (JSON)
```

### Why a Backend Proxy is Required
- GitHub API does not allow CORS from browsers
- The user's PAT must never be exposed to the browser
- The proxy handles authentication, request forwarding, and response parsing

### Recommended Backend: Express Server
Create `site/server.ts`:
- Serves static files from `site/dist`
- Proxies `/api/*` to `https://api.github.com`
- Handles CORS
- Can be deployed to Fly.io, Railway, Render, etc.

---

## 5. FILE MAP

```
.
├── .github/
│   └── workflows/
│       ├── vm.yml               ← Terminal VM backend (SOLID)
│       └── vm-desktop.yml       ← Desktop VM backend
├── cli/
│   ├── package.json             ← Name: toatcloud-terminal
│   ├── src/
│   │   ├── api.ts               ← GitHub API client
│   │   ├── banner.ts            ← ASCII + BRAND = "ToatCloud Terminal"
│   │   ├── index.ts             ← CLI commands
│   │   ├── ttyd.ts              ← WebSocket client for -sync/-exec
│   │   ├── util.ts              ← Helpers
│   │   └── version.ts           ← VERSION = "0.3.0"
│   └── dist/                    ← Built CLI
├── cli-lite/
│   ├── package.json             ← Name: toatcloud-terminal-lite
│   └── src/                     ← Minimal CLI
├── site/
│   ├── package.json             ← React + Vite + xterm.js
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx             ← React mount
│   │   ├── App.tsx              ← Home + Terminal views
│   │   ├── App.css
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── BootForm.tsx     ← Form to boot a VM
│   │   │   └── Terminal.tsx     ← xterm.js + WebSocket
│   │   └── vite-env.d.ts
│   └── dist/                    ← Built site
├── CODE_OF_CONDUCT.md           ← Contributor Covenant
├── SECURITY.md                  ← Security policy
├── TERMS.md                     ← Terms of use
├── LICENSE                      ← Apache 2.0
├── README.md                    ← Project README
└── DEVELOPER_PROMPT.md          ← THIS FILE
```

---

## 6. WHAT TO BUILD NEXT (PRIORITY ORDER)

### P0: API Proxy (Required for web client to work)

Create `site/server.ts` with Express:

```ts
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("dist"));

// Proxy /api/boot → GitHub workflow_dispatch
app.post("/api/boot", async (req, res) => {
  const { owner, repo, token, mode, image, username, cycle, env, preRun, postRun, cpuLimit, memLimit, diskSize, ports, label } = req.body;
  // Forward to GitHub API
  const ghRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/vm.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          lifetime: String(cycle),
          image,
          username,
          env: JSON.stringify(env ?? {}),
          "pre-run": preRun ?? "",
          "post-run": postRun ?? "",
          "cpu-limit": cpuLimit ?? "1",
          "mem-limit": memLimit ?? "2",
          "disk-size": diskSize ?? "10",
          ports: ports ?? "",
          label: label ?? "",
        },
      }),
    }
  );
  // ...
});

// Proxy /api/status → listRuns + findRunInfo
app.get("/api/status", async (req, res) => {
  // ...
});

app.listen(3000);
```

Then update `BootForm.tsx` to POST to `/api/boot` instead of `/api/boot` (same path, now handled by Express).

### P1: WebSocket Flow in Terminal.tsx

After `handleBoot` returns a URL:
1. Set `terminalUrl` state
2. `Terminal.tsx` connects xterm.js to `{url}/websocket`
3. Handle binary frames (type 0 = data, type 1 = resize)
4. Handle reconnection on drop

### P2: Status Polling

After booting, poll `/api/status` every 5s to find the tunnel URL in logs.
Show a spinner until the URL appears.

### P3: Deployment

- Build: `cd site && npm run build`
- Deploy `site/dist/` to Cloudflare Pages / Vercel / Netlify
- Deploy `site/server.ts` to a Node host (Fly.io, Railway, Render)
- Update CORS in server to allow site origin

---

## 7. DESIGN GUIDELINES

- **Dark theme only** — terminal should feel like a real shell
- **Minimal chrome** — the terminal is the UI
- **No emojis** — clean text branding
- **Brand**: ToatCloud Terminal
- **Colors**:
  - Background: `#07090f`
  - Panel: `#0e1320`
  - Border: `#1d2433`
  - Accent: `#82aaff`
  - Accent2: `#c3e88d`
  - Text: `#c8d3f5`
  - Muted: `#6b7394`

---

## 8. GOTCHAS

- **GitHub Actions boot time**: 30-60 seconds. UI must show a spinner.
- **Tunnel URL discovery**: Found in job logs, not immediate. Must poll.
- **ttyd WebSocket protocol**: Binary frames. Type 0 = input/output, Type 1 = resize (JSON payload).
- **PAT exposure**: NEVER expose the user's PAT in the browser. All GitHub API calls go through the backend proxy.
- **Cloudflared URLs**: Random per boot. Change every session.
- **Runner ephemerality**: Runners die after ~6h or can be reclaimed anytime.
- **CORS**: GitHub API blocks browser requests. Must use proxy.
- **Input escaping**: Docker exec commands in vm.yml need careful shell escaping.

---

## 9. TESTING CHECKLIST

When implementing new features, verify:

```bash
# CLI builds
cd cli && npm run build
node dist/index.js -version   # should print 0.3.0
node dist/index.js -help

# Lite CLI builds
cd cli-lite && npm run build
node dist/index-lite.js -version

# Site builds
cd site && npm run build
# should produce site/dist/ with no errors

# Site dev server starts
cd site && npm run dev
# should serve at http://localhost:5173
```

### End-to-end test (requires GitHub account with Actions enabled):
```bash
toatcloud-terminal -new
toatcloud-terminal -init
# → boot a terminal session
# → confirm URL appears
# → open in browser
# → type commands
# → toatcloud-terminal -stop
```

---

## 10. COMMIT CONVENTIONS

- Keep commits small and focused
- Message only, no paragraph body
- Use present tense: "Add", "Fix", "Update"
- Prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`

Examples:
```
feat: add Express API proxy for web client
fix: align workflow input keys with CLI
docs: update DEVELOPER_PROMPT with gotchas
refactor: extract boot inputs into buildInputs
```

---

## 11. RELEASE PROCESS

1. Update version in `cli/package.json`, `cli/src/version.ts`
2. Update `CHANGELOG.md` (if exists)
3. Commit: `release: v0.3.1`
4. Tag: `git tag v0.3.1 && git push origin v0.3.1`
5. Publish manually:
   ```bash
   cd cli && npm publish
   cd cli-lite && npm publish
   ```

---

## 12. CONTACT

- Issues: https://github.com/Seigh-sword/ToatVM/issues
- Email: seighsword@gmail.com
- Security: seighsword@gmail.com (subject: SECURITY)

---

## 13. QUICK REFERENCE

| Need | Command |
| --- | --- |
| Build CLI | `cd cli && npm run build` |
| Build Lite | `cd cli-lite && npm run build` |
| Build Site | `cd site && npm run build` |
| Dev Site | `cd site && npm run dev` |
| Boot VM (CLI) | `toatcloud-terminal -init` |
| Stop VM | `toatcloud-terminal -stop` |
| Check Status | `toatcloud-terminal -status` |

---

## 14. NEXT SESSION START HERE

When you (the next AI) start working on this project:

1. Read this entire file.
2. Check `git status` and `git log --oneline -10`.
3. Review `cli/src/api.ts` to understand the GitHub API client.
4. Review `.github/workflows/vm.yml` to understand the backend.
5. Review `site/src/components/Terminal.tsx` to understand the frontend.
6. Start with P0: Build the API proxy in `site/server.ts`.
7. Test with `cd site && npm run dev`.
8. Do NOT modify `.github/workflows/vm.yml` unless the user asks.
9. Do NOT publish to npm unless explicitly asked.
10. Do NOT add emojis anywhere.
