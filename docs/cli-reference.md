# CLI Reference

Complete reference for the `toatcloud-terminal` CLI. All commands are prefixed with a single dash when invoked.

## Commands

| Command | Description |
| --- | --- |
| `-init` | Interactive wizard: pick account, OS, boot, then control |
| `-new` | Create a new account (saved locally) |
| `-auth` | Save or update a token for an existing account |
| `-accounts` | List saved accounts |
| `-select <name>` | Set the active account |
| `-remove <name>` | Delete a saved account |
| `-list` | List recent workflow runs for the active account |
| `-status` | Show the current session (URL + credentials) if live |
| `-url [--copy]` | Print or copy the live tunnel URL |
| `-logs` | Stream the active run's job logs |
| `-boot` | Boot a VM non-interactively (see flags below) |
| `-stop` | Gracefully stop the active session (cache, then close) |
| `-kill` | Immediately cancel the active run |
| `-open` | Open the live URL in your default browser |
| `-ssh` | Print an SSH command pre-filled with the VM credentials |
| `-sync <dir>` | Upload a local folder into the VM (`$HOME/sync`) over the tunnel |
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

## Command Details and Examples

### Account Management

#### `-new`

Create a new saved GitHub account.

```bash
toatcloud-terminal -new
```

Prompts for account name, owner, repository, and PAT.

#### `-auth`

Update the PAT for an existing account.

```bash
toatcloud-terminal -auth
```

#### `-accounts`

List all saved accounts.

```bash
toatcloud-terminal -accounts
```

Output:

```
- myaccount (active): myuser/myrepo
- work: myorg/actions-repo
```

#### `-select <name>`

Set the active account by name or ID.

```bash
toatcloud-terminal -select myaccount
```

#### `-remove <name>`

Delete a saved account.

```bash
toatcloud-terminal -remove myaccount
```

### Session Control

#### `-init`

Interactive wizard to pick account, mode, OS, and boot a session.

```bash
toatcloud-terminal -init
```

#### `-boot`

Boot a VM non-interactively.

```bash
toatcloud-terminal -boot \
  --account myaccount \
  --mode t \
  --os ubuntu:latest \
  --user toat \
  --pass mypassword \
  --cycle 60 \
  --name "dev-session" \
  --cpu 1 \
  --mem 2 \
  --disk 10 \
  --ports 8080:80,3000:3000 \
  --env '{"NODE_ENV":"development","PORT":"3000"}' \
  --pre-run "apt update" \
  --post-run "echo 'done'"
```

#### `-status`

Show the live session URL and credentials.

```bash
toatcloud-terminal -status
```

Output:

```
Live URL: https://abc123.trycloudflare.com
login:      toat / abcdef123456
run:        myuser/myrepo #12345
health:     in_progress
  job Terminal VM: in_progress (running)
```

#### `-url [--copy]`

Print the live URL, or copy it to the clipboard.

```bash
toatcloud-terminal -url
toatcloud-terminal -url --copy
```

#### `-logs`

Stream the active run's job logs.

```bash
toatcloud-terminal -logs
```

#### `-stop`

Gracefully stop the active session (caches state, then closes).

```bash
toatcloud-terminal -stop
```

#### `-kill`

Immediately cancel the active run without caching.

```bash
toatcloud-terminal -kill
```

#### `-open`

Open the live URL in your default browser.

```bash
toatcloud-terminal -open
```

#### `-ssh`

Print an SSH command pre-filled with VM credentials.

```bash
toatcloud-terminal -ssh
```

Output:

```
ssh toat@abc123.trycloudflare.com -p 22
```

### File and Command Operations

#### `-sync <dir>`

Upload a local directory into the VM over the tunnel.

```bash
toatcloud-terminal -sync ./my-project
```

Files are extracted into `$HOME/sync` on the VM.

#### `-exec "<cmd>"`

Run a command on the live VM.

```bash
toatcloud-terminal -exec "uname -a"
toatcloud-terminal -exec "ls -la /home/toat"
```

#### `-share [pw]`

Password-protect the shared tunnel (ttyd basic auth).

```bash
toatcloud-terminal -share
toatcloud-terminal -share mypassword
```

#### `-unshare`

Remove the share password.

```bash
toatcloud-terminal -unshare
```

### Templates

#### `-template save <name>`

Save the current session configuration as a template.

```bash
toatcloud-terminal -template save ubuntu-dev
```

#### `-template list`

List saved templates.

```bash
toatcloud-terminal -template
toatcloud-terminal -template list
```

#### `-template apply <id>`

Apply a saved template and boot a session.

```bash
toatcloud-terminal -template apply ubuntu-dev
```

#### `-template delete <id>`

Delete a saved template.

```bash
toatcloud-terminal -template delete ubuntu-dev
```

### Ports and Environment

#### `-port list`

List port forwards for the current session.

```bash
toatcloud-terminal -port list
```

#### `-port add <host:container>`

Add a port forward (stored in templates).

```bash
toatcloud-terminal -port add 8080:80
```

#### `-env list`

List stored environment variable keys.

```bash
toatcloud-terminal -env list
```

#### `-env set KEY=VALUE`

Set an environment variable for the next boot.

```bash
toatcloud-terminal -env set NODE_ENV=production
```

#### `-env delete KEY`

Delete an environment variable.

```bash
toatcloud-terminal -env delete NODE_ENV
```

### Monitoring

#### `-health [runId]`

Check the health of the active or a specific run.

```bash
toatcloud-terminal -health
toatcloud-terminal -health 12345
```

Output:

```
Run #12345: in_progress
  [..] Terminal VM: in_progress (running)
```

#### `-history`

Show detailed session history.

```bash
toatcloud-terminal -history
```

Output:

```
  ID       Status        Workflow    Created
  -------  ------------  ----------  -------
  #12345   in_progress   terminal    7/20/2026, 6:30:00 PM
  #12344   completed     terminal    7/20/2026, 5:30:00 PM
```

#### `-list`

List recent workflow runs.

```bash
toatcloud-terminal -list
```

### Import and Export

#### `-import <file>`

Import accounts from a JSON file.

```bash
toatcloud-terminal -import accounts.json
```

#### `-export [file]`

Export accounts to a JSON file.

```bash
toatcloud-terminal -export
toatcloud-terminal -export my-accounts.json
```

### Cleanup

#### `-cleanup`

Cancel all active runs for terminal and desktop workflows.

```bash
toatcloud-terminal -cleanup
```

## Global Flags

Global flags are available for `-boot` and `-init`.

| Flag | Description | Default |
| --- | --- | --- |
| `--account <name>` | Use a specific saved account | Active account |
| `--mode <t|d>` | Terminal (`t`) or desktop (`d`) | `t` |
| `--os <image>` | Docker OS image (terminal mode only) | `ubuntu:latest` |
| `--user <name>` | Shell username inside the VM | `toat` |
| `--pass <pw>` | Shell password (random if blank) | Random |
| `--cycle <min>` | Minutes per cycle before restart | `60` |
| `--name <label>` | Friendly session name (stored locally) | None |
| `--env <json>` | Environment variables as JSON object | `{}` |
| `--pre-run <cmd>` | Shell command to run inside VM on boot | None |
| `--post-run <cmd>` | Shell command to run inside VM after cycle | None |
| `--ports <list>` | Comma-separated host:container ports | None |
| `--cpu <cores>` | CPU limit for the container | `1` |
| `--mem <gb>` | Memory limit for the container (GB) | `2` |
| `--disk <gb>` | Disk size for the container (GB) | `10` |

## OS Images

| Image | Label |
| --- | --- |
| `ubuntu:latest` | Ubuntu |
| `debian:latest` | Debian |
| `archlinux:latest` | Arch Linux |
| `alpine:latest` | Alpine |
| `fedora:latest` | Fedora |
| `kalilinux/kali-rolling` | Kali |

## Configuration

Accounts are stored locally at:

```
~/.config/toatvm/config.json
```

Templates are stored at:

```
~/.config/toatvm/templates/
```

The PAT must have `repo` and `workflow` scopes.
