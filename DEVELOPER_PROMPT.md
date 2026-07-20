# ToatCloud Terminal — Developer Prompt

## Vision

ToatCloud Terminal is a **terminal in your browser**, powered by GitHub Actions runners. Users should be able to:
1. Open the website
2. Enter their GitHub repo + PAT
3. Click "Boot Terminal"
4. Get a live Linux shell in their browser via xterm.js + WebSocket

The CLI (`toatvm` / `toatvm-lite`) is for power users. The **web client is the primary product**.

---

## Current State

### What works
- **Backend**: `.github/workflows/vm.yml` boots a Docker container, runs ttyd, tunnels via cloudflared. This is solid.
- **CLI**: `toatvm` and `toatvm-lite` can boot VMs, get URLs, and manage accounts. Works locally.
- **Web client scaffold**: `site/` has React + Vite + TypeScript + xterm.js. The UI is built but not connected to the backend.

### What's broken / missing
- **No API proxy**: The React app can't call GitHub API directly (CORS + token exposure). Needs a lightweight backend.
- **No WebSocket flow**: The terminal component needs a real ttyd URL to connect to.
- **No deployment config**: Site isn't deployed anywhere yet.

---

## Architecture

```
User browser
    │
    ▼
React + Vite site (site/)
    │
    ├─ /api/boot    → needs a backend proxy (Express / Vite plugin / CF Worker)
    ├─ /api/status  → needs a backend proxy
    └─ WebSocket    → direct to cloudflared tunnel (ttyd)
```

### Backend proxy options (pick one)
1. **Vite middleware** (simplest for dev) — proxy `/api/*` to GitHub API
2. **Cloudflare Worker** — deploy alongside the site, handles CORS + auth
3. **Express server** — separate `site/server.ts` that serves the built React app and proxies API calls

### Recommended: Express server
- Create `site/server.ts` with Express
- Serves static files from `site/dist`
- Proxies `/api/*` to `https://api.github.com`
- Handles CORS
- Can be deployed to any Node host (Fly, Railway, etc.)

---

## File Map

```
site/
  package.json          ← React + Vite + xterm.js deps
  tsconfig.json         ← TS config for React
  vite.config.ts        ← Vite config
  index.html            ← SPA entry
  src/
    main.tsx            ← React mount
    App.tsx             ← Main app (home + terminal views)
    App.css             ← Styles
    index.css           ← Global styles
    components/
      BootForm.tsx      ← Form to boot a VM
      Terminal.tsx      ← xterm.js + WebSocket terminal
    vite-env.d.ts       ← TS declarations
```

---

## What to build next

### 1. API proxy (required)
The React app needs to call GitHub's API to:
- Dispatch workflows (`POST /repos/{owner}/{repo}/actions/workflows/vm.yml/dispatches`)
- Read run logs to find the tunnel URL
- Cancel runs / set variables

**Do NOT expose the user's PAT in the browser.** All GitHub API calls must go through a backend.

Create `site/server.ts`:
```ts
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("dist"));

app.post("/api/boot", async (req, res) => {
  const { owner, repo, token, ...rest } = req.body;
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
      body: JSON.stringify({ ref: "main", inputs: rest }),
    }
  );
  // ...
});

app.listen(3000);
```

### 2. WebSocket flow
After booting, the app needs to:
1. Poll `/api/status` to get the tunnel URL
2. Connect xterm.js directly to `{url}/websocket`
3. Handle resize, input, and connection drops

### 3. Deployment
- Build: `npm run build` → `site/dist/`
- Deploy `site/dist/` to Cloudflare Pages / Vercel / Netlify
- Deploy `site/server.ts` to a Node host
- Update CORS to allow the site origin

---

## Design guidelines

- **Dark theme only** — the terminal should feel like a real shell
- **Minimal chrome** — the terminal is the UI
- **No emojis** — clean text branding
- **Brand**: ToatCloud Terminal
- **Colors**: bg `#07090f`, panel `#0e1320`, accent `#82aaff`, text `#c8d3f5`

---

## Commands

```bash
# Install deps
cd site && npm install

# Dev server (frontend only)
npm run dev

# Build
npm run build

# Preview
npm run preview
```

---

## Gotchas

- GitHub Actions runners take 30-60s to boot. The UI must show a spinner.
- The tunnel URL is found in job logs, not immediately. Poll `findRunInfo` logic from `cli/src/api.ts`.
- ttyd WebSocket protocol: binary frames, type 0 = input/output, type 1 = resize (JSON).
- The user's PAT must never leave the backend proxy.
- Cloudflared tunnels are random URLs. They change every boot.

---

## Success criteria

1. User opens site, enters GitHub repo + PAT, clicks Boot
2. Spinner shows "Booting..."
3. After ~30s, xterm.js terminal appears with a working shell
4. User can type commands, see output, resize window
5. User can close terminal, come back, and re-attach via `-url` or site
