# 🐸 ToatVM

> A website that runs a **virtual machine inside a GitHub Actions runner**.
> Experimental, ephemeral, not for permanent or production use.

ToatVM (the "Toat") is a joke-but-real experiment: instead of paying for a VPS,
you borrow a GitHub-hosted runner (standard runners ship with ~7 GB RAM, and the
larger runners go up to 16 GB) and expose its shell to your browser through a
tunnel. The frontend is a static **React + TypeScript (Vite)** app deployed to
**Cloudflare Pages** (`toatvm.pages.dev`), so the GitHub Actions backend keeps
working even after the site is hosted on Cloudflare.

```
 Browser ──► Cloudflare Pages (static SPA) ──► api.github.com (dispatch/read)
                                              │
                                              ▼
                                   GitHub Actions runner
                                   (tmux + ttyd + cloudflared)
                                              │
                                              ▼
                              *.trycloudflare.com ← xterm.js WebSocket
```

## How it works

1. You open the site and paste a GitHub **Personal Access Token** (stored only
   in your browser's `localStorage`). The token needs `repo` and `workflow`
   scopes.
2. Click **Boot VM**. The app calls the GitHub REST API to trigger the
   `vm.yml` workflow (`workflow_dispatch`).
3. The runner installs [`ttyd`](https://github.com/tsl0922/ttyd) (a terminal
   over WebSocket) and [`cloudflared`](https://github.com/cloudflare/cloudflared),
   starts a `tmux` session, and tunnels it to a random `*.trycloudflare.com`
   URL.
4. The runner prints that URL to the job log (and, if the repo grants
   workflow write permission, also to a `VM_URL` repo variable). The site
   reads the URL from the run's job logs using *your* PAT — so no special
   token permission is required for discovery.
5. Each **cycle runs ~1 hour**, then the runner saves its `vm-state` to
   Actions cache and re-dispatches itself. A single job is capped at **6 hours**
   by GitHub; the re-dispatch keeps the machine alive across runs by restoring
   the cached state.

## ⚠ Disclaimers

- **Ephemeral & public.** The tunnel URL is reachable by anyone who finds it.
  No authentication is applied beyond the random URL. Do **not** run anything
  sensitive.
- **Not permanent.** Runners and caches are reclaimed; state can vanish.
- **Abuse the platform and you'll get banned.** Keep this experimental and
  low-traffic.
- The `VM_URL` variable and `vm-state` cache are tied to the repo that owns the
  workflow.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + bundle to dist/
npm run preview
```

## Deploy to Cloudflare Pages

The app is 100% static, so Pages just builds and serves `dist/`.

**Via the dashboard (recommended):**
- Build command: `npm run build`
- Build output directory: `dist`
- No environment variables required.

**Via CLI:**
```bash
npm install
npx wrangler pages deploy dist
# or: npm run deploy
```

`wrangler.toml` and `public/_headers` are included for convenience. Because the
site talks to `api.github.com` directly from the browser, there is no server or
Pages Function needed, and the GitHub Actions backend is unaffected by where the
frontend is hosted.

## Project layout

```
.github/workflows/vm.yml   The "VM": runner bootstrap, tunnel, cache loop
src/api.ts                 GitHub REST client (dispatch / read VM_URL / runs)
src/components/Terminal.tsx  xterm.js client for the ttyd WebSocket
src/App.tsx                Session panel + connection orchestration
src/styles.css             Dark theme
vite.config.ts             Vite config (base "./" for static hosting)
wrangler.toml             Cloudflare Pages deploy config
```

## License

MIT — see [LICENSE](./LICENSE).
