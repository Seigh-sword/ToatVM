# Frequently Asked Questions

## What is ToatCloud Terminal?

ToatCloud Terminal is a browser-based terminal that uses GitHub Actions runners to run Docker containers of various Linux distributions. It exposes a shell via `ttyd` and a `cloudflared` tunnel, giving you a `*.trycloudflare.com` URL you can open in any browser.

## How much does it cost?

The runners are provided by GitHub's free or included Actions minutes for your account. You are only limited by your GitHub Actions minute quota. There is no separate charge for ToatCloud Terminal itself.

## Which operating systems are supported?

The following Docker images are available for terminal mode:

| OS | Docker Image |
| --- | --- |
| Ubuntu | `ubuntu:latest` |
| Debian | `debian:latest` |
| Arch Linux | `archlinux:latest` |
| Alpine | `alpine:latest` |
| Fedora | `fedora:latest` |
| Kali | `kalilinux/kali-rolling` |

Desktop mode uses Ubuntu with XFCE.

## How long does a session last?

Each cycle runs for the configured length (default 60 minutes). When a cycle expires, the runner caches the container's home directory and automatically starts a new run, giving you an effectively persistent session. The total lifetime per runner is approximately 6 hours.

## How do I stop a session gracefully?

Run `toatcloud-terminal -stop`. This sets the `VM_STOP` repo variable, which the runner detects. It runs the post-run script, saves the state cache, and exits without re-dispatching.

To stop immediately without caching, use `toatcloud-terminal -kill`.

## Is my data private?

No. The tunnel URL is publicly accessible, and the Actions logs (which include the VM credentials) are visible depending on your repository's visibility settings. Do not store sensitive data in ToatCloud Terminal sessions. This is an experimental tool, not a replacement for a private VM or cloud host.

## Can I run multiple sessions at once?

Yes, if you use different GitHub accounts or repositories. Each account/repo combination runs its own independent workflow. Within a single repo, only one terminal or desktop session can be active at a time due to GitHub Actions concurrency settings.

## How do I share a session with someone else?

Use the share command to enable password protection:

```bash
toatcloud-terminal -share
```

This sets a ttyd basic auth password. Share the tunnel URL; others connect with username `toat` and your password. Use `-unshare` to remove the password.

## How do I transfer files to the VM?

Use the sync command:

```bash
toatcloud-terminal -sync ./my-folder
```

This uploads the folder into `$HOME/sync` on the VM using the ttyd WebSocket. The folder is packed into a tar.gz archive, base64-encoded, and streamed in chunks.

## Why does my session restart automatically?

Sessions are designed to cycle. After the configured cycle length (default 60 minutes), the runner saves the home directory to GitHub Actions cache and re-dispatches the workflow. This is expected behavior. If you want to stop the cycle, use `-stop`.

## What scopes does my PAT need?

Your GitHub Personal Access Token must have the following scopes:
- `repo` — to read and write repository data
- `workflow` — to trigger and monitor Actions runs

## How do I self-host the backend?

Fork the repository, enable GitHub Actions, and add a PAT with `repo` and `workflow` scopes. When creating an account with `-new`, point to your fork as the owner and repository. All workflow runs will execute in your fork instead of the upstream.

## What ports can I forward?

You can forward any ports using the `--ports` flag. For example:

```bash
toatcloud-terminal -boot --ports 8080:80,3000:3000,5432:5432
```

Ports are passed to the Docker container and exposed through the cloudflared tunnel.

## Why does my boot take so long?

First boots are slower because the runner must:
1. Pull the Docker image (can take 1-3 minutes depending on the image size)
2. Install `ttyd` and `cloudflared`
3. Start the container and services
4. Establish the tunnel

Subsequent boots are faster because the Docker layer cache is warm.

## Can I use a custom Docker image?

Yes. Pass a custom image with the `--os` flag. The image must have a shell (`bash` or `sh`) for terminal mode. The CLI creates a user inside the container, so the image does not need to come with a preconfigured user.

## What happens when my GitHub Actions minutes run out?

When your minutes are exhausted, the runner will not start, and the workflow will fail. You will see an error in the Actions tab. Wait for your minutes to reset or upgrade your GitHub plan.

## How do I update the CLI?

```bash
npm update -g toatcloud-terminal
```

Or reinstall:

```bash
npm i -g toatcloud-terminal
```

## Where is my configuration stored?

Accounts and templates are stored locally at:

```
~/.config/toatvm/config.json
~/.config/toatvm/templates/
```

Session state is stored in GitHub Actions cache keyed by `github.run_id`.
