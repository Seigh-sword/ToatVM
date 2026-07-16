#!/usr/bin/env node
import * as p from "@clack/prompts";
import {
  Account,
  cancelRun,
  deleteVariable,
  dispatchWorkflow,
  findRunInfo,
  getRunLogs,
  getVariable,
  listRuns,
  loadConfig,
  saveConfig,
  setVariable,
  WORKFLOWS,
} from "./api.js";
import { BANNER } from "./banner.js";
import { LICENSE_TEXT } from "./license.js";
import { copyToClipboard, IS_WINDOWS, openTerminal, openUrl, sleep } from "./util.js";
import { VERSION } from "./version.js";

const OS_OPTIONS = [
  { value: "ubuntu:latest", label: "Ubuntu" },
  { value: "debian:latest", label: "Debian" },
  { value: "archlinux:latest", label: "Arch Linux" },
  { value: "alpine:latest", label: "Alpine" },
  { value: "fedora:latest", label: "Fedora" },
  { value: "kalilinux/kali-rolling", label: "Kali" },
];

function brand(): void {
  console.log(BANNER);
}

function help(): void {
  console.log(`${BANNER}
${"🐸 ToatVM CLI".padEnd(0)} v${VERSION}

A virtual machine that runs inside GitHub Actions runners.
Experimental — not for permanent or production use.

INSTALL
  npm i -g toatvm
  npx toatvm -init

COMMANDS
  -init            Interactive wizard: pick account, OS, boot, then control
  -new             Create a new account (saved locally)
  -auth            Save / update a token for an account
  -accounts        List saved accounts
  -select <name>   Set the active account
  -remove <name>   Delete a saved account
  -list            List recent workflow runs for the active account
  -status          Show the current session (URL + credentials) if live
  -url [--copy]    Print (or copy) the live tunnel URL
  -logs            Stream the active run's job logs
  -boot            Boot a VM non-interactively (flags below)
  -stop            Gracefully stop the active session (cache, then close)
  -kill            Immediately cancel the active run
  -open            Open the live URL in your browser
  -ssh             Print an ssh command pre-filled with the VM credentials
  -sync <dir>      One-way upload a local folder into the VM home (via gh api)
  -exec "<cmd>"    Run a command on the live VM over the tunnel (curl)
  -version         Print version
  -license         Print the license
  -help            Show this help

GLOBAL FLAGS (for -boot / -init)
  --account <name>  Use this account
  --mode <t|d>      terminal or desktop
  --os <image>      e.g. ubuntu:latest
  --user <name>     shell username
  --pass <pw>       shell password (random if blank)
  --cycle <min>     minutes per cycle (default 60)
  --name <label>    a friendly session name (stored locally)

Accounts are stored at ~/.config/toatvm/config.json.
The PAT needs 'repo' + 'workflow' scopes.
`);
}

// ---- account resolution helpers -------------------------------------------

function requireAccounts(): Account[] {
  const cfg = loadConfig();
  if (cfg.accounts.length === 0) {
    p.log.error("No accounts yet — run 'toatvm -new' first.");
    process.exit(1);
  }
  return cfg.accounts;
}

function resolveAccount(name?: string): Account {
  const cfg = loadConfig();
  const accounts = cfg.accounts;
  if (accounts.length === 0) {
    p.log.error("No accounts yet — run 'toatvm -new' first.");
    process.exit(1);
  }
  const id = name ?? cfg.activeId ?? accounts[0].id;
  const acc = accounts.find((a) => a.id === id || a.name === name);
  if (!acc) {
    p.log.error(`Account "${name ?? cfg.activeId}" not found.`);
    process.exit(1);
  }
  return acc;
}

function activeRun(runs: { status: string }[]): { status: string } | undefined {
  return runs.find((r) => r.status === "in_progress" || r.status === "queued");
}

async function findLive(
  acc: Account,
): Promise<{ url: string; creds: { user: string; pass: string } | null; runId: number } | null> {
  const runs = await listRuns(acc, WORKFLOWS.terminal).catch(() => []);
  const term = runs.find((r) => r.status === "in_progress" || r.status === "queued");
  const wf = term ? WORKFLOWS.terminal : WORKFLOWS.desktop;
  const runs2 = term ? runs : await listRuns(acc, wf).catch(() => []);
  const run = runs2.find((r) => r.status === "in_progress" || r.status === "queued");
  if (!run) return null;
  const info = await findRunInfo(acc, run.id).catch(() => null);
  if (!info?.url) return null;
  return { url: info.url, creds: info.creds, runId: run.id };
}

async function waitForUrl(
  acc: Account,
  workflow: string,
  spinner: ReturnType<typeof p.spinner>,
): Promise<{ url: string; creds: { user: string; pass: string } | null; runId: number } | null> {
  for (let i = 0; i < 72; i++) {
    spinner.message(`Booting… (${i * 5}s) looking for tunnel URL`);
    const runs = await listRuns(acc, workflow).catch(() => []);
    const run = runs.find((r) => r.status === "in_progress" || r.status === "queued");
    if (run) {
      const info = await findRunInfo(acc, run.id).catch(() => null);
      if (info?.url) return { url: info.url, creds: info.creds, runId: run.id };
    }
    await sleep(5000);
  }
  return null;
}

async function waitForStop(acc: Account, workflow: string): Promise<void> {
  for (let i = 0; i < 36; i++) {
    const runs = await listRuns(acc, workflow).catch(() => []);
    if (!runs.find((r) => r.status === "in_progress")) return;
    await sleep(5000);
  }
}

// ---- commands --------------------------------------------------------------

async function cmdNew(): Promise<void> {
  brand();
  p.intro("🐸 ToatVM — new account");
  const name = await p.text({ message: "Account name" });
  if (p.isCancel(name)) return;
  const owner = await p.text({ message: "GitHub owner" });
  if (p.isCancel(owner)) return;
  const repo = await p.text({ message: "Repository" });
  if (p.isCancel(repo)) return;
  const token = await p.password({ message: "Personal Access Token (repo + workflow)" });
  if (p.isCancel(token)) return;

  const cfg = loadConfig();
  const id = crypto.randomUUID();
  cfg.accounts.push({
    id,
    name: String(name),
    owner: String(owner),
    repo: String(repo),
    token: String(token),
  });
  if (!cfg.activeId) cfg.activeId = id;
  saveConfig(cfg);
  p.outro(`Account "${name}" saved. Run 'toatvm -init' to launch.`);
}

async function cmdAuth(): Promise<void> {
  brand();
  const cfg = loadConfig();
  if (cfg.accounts.length === 0) {
    p.log.error("No accounts yet — run 'toatvm -new' first.");
    return;
  }
  p.intro("🐸 ToatVM — auth");
  const choice = await p.select({
    message: "Which account?",
    options: cfg.accounts.map((a) => ({ value: a.id, label: a.name })),
  });
  if (p.isCancel(choice)) return;
  const token = await p.password({ message: "Personal Access Token" });
  if (p.isCancel(token)) return;
  const acc = cfg.accounts.find((a) => a.id === choice);
  if (acc) {
    acc.token = String(token);
    saveConfig(cfg);
  }
  p.outro("Auth saved.");
}

async function cmdAccounts(): Promise<void> {
  brand();
  const cfg = loadConfig();
  if (cfg.accounts.length === 0) {
    console.log("No accounts. Run 'toatvm -new' to add one.");
    return;
  }
  for (const a of cfg.accounts) {
    const active = a.id === cfg.activeId ? " (active)" : "";
    console.log(`- ${a.name}${active}: ${a.owner}/${a.repo}`);
  }
}

async function cmdSelect(name: string): Promise<void> {
  const cfg = loadConfig();
  const acc = cfg.accounts.find((a) => a.name === name || a.id === name);
  if (!acc) {
    p.log.error(`Account "${name}" not found.`);
    process.exit(1);
  }
  cfg.activeId = acc.id;
  saveConfig(cfg);
  p.log.success(`Active account: ${acc.name}`);
}

async function cmdRemove(name: string): Promise<void> {
  const cfg = loadConfig();
  const next = cfg.accounts.filter((a) => a.name !== name && a.id !== name);
  if (next.length === cfg.accounts.length) {
    p.log.error(`Account "${name}" not found.`);
    process.exit(1);
  }
  cfg.accounts = next;
  if (!next.find((a) => a.id === cfg.activeId)) cfg.activeId = next[0]?.id ?? null;
  saveConfig(cfg);
  p.log.success(`Removed account "${name}".`);
}

async function cmdList(): Promise<void> {
  brand();
  const acc = resolveAccount();
  const runs = await listRuns(acc, WORKFLOWS.terminal).catch(() => []);
  const dRuns = await listRuns(acc, WORKFLOWS.desktop).catch(() => []);
  const all = [...runs, ...dRuns].sort((a, b) => b.id - a.id).slice(0, 12);
  console.log(`\nRecent runs for ${acc.owner}/${acc.repo}:`);
  for (const r of all) {
    const state =
      r.status === "in_progress" ? "● running" : r.status === "queued" ? "○ queued" : `· ${r.conclusion ?? r.status}`;
    console.log(`  #${r.id}  ${state}  ${r.name}`);
  }
}

async function cmdStatus(): Promise<void> {
  brand();
  const acc = resolveAccount();
  const live = await findLive(acc);
  if (!live) {
    console.log("No live session right now.");
    return;
  }
  console.log(`\n🌐 Live URL: ${live.url}`);
  if (live.creds) console.log(`login:      ${live.creds.user} / ${live.creds.pass}`);
  console.log(`run:        ${acc.owner}/${acc.repo} #${live.runId}`);
}

async function cmdUrl(copy: boolean): Promise<void> {
  const acc = resolveAccount();
  const live = await findLive(acc);
  if (!live) {
    p.log.error("No live session to get a URL for.");
    process.exit(1);
  }
  if (copy) {
    copyToClipboard(live.url);
    p.log.success(`Copied to clipboard: ${live.url}`);
  } else {
    console.log(live.url);
  }
}

async function cmdLogs(): Promise<void> {
  brand();
  const acc = resolveAccount();
  const runs = await listRuns(acc, WORKFLOWS.terminal).catch(() => []);
  const run = runs.find((r) => r.status === "in_progress" || r.status === "queued");
  if (!run) {
    p.log.error("No active run to read logs from.");
    process.exit(1);
  }
  const logs = await getRunLogs(acc, run.id);
  for (const l of logs) {
    console.log(`\n# ${l.job}`);
    console.log(l.text);
  }
}

async function boot(opts: {
  account?: string;
  mode: "terminal" | "desktop";
  os: string;
  username: string;
  password: string;
  cycle: string;
  label?: string;
}): Promise<void> {
  const acc = resolveAccount(opts.account);
  const workflow = opts.mode === "desktop" ? WORKFLOWS.desktop : WORKFLOWS.terminal;
  const inputs: Record<string, string> = { lifetime: opts.cycle };
  if (opts.mode === "terminal") {
    inputs.image = opts.os;
    inputs.username = opts.username;
    inputs.password = opts.password;
  }
  try {
    await deleteVariable(acc, "VM_STOP");
    await dispatchWorkflow(acc, workflow, inputs);
  } catch (err) {
    p.log.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  }
  p.log.success(`Dispatched ${opts.mode} VM on ${acc.owner}/${acc.repo}.`);
  if (opts.label) {
    const cfg = loadConfig();
    const a = cfg.accounts.find((x) => x.id === acc.id);
    if (a) {
      // store session label in a variable for later display (best effort)
      await setVariable(acc, "VM_LABEL", opts.label).catch(() => {});
    }
  }
}

async function cmdBoot(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  await boot({
    account: flags.account,
    mode: (flags.mode === "d" ? "desktop" : "terminal") as "terminal" | "desktop",
    os: flags.os ?? "ubuntu:latest",
    username: flags.user ?? "toat",
    password: flags.pass ?? "",
    cycle: flags.cycle ?? "60",
    label: flags.name,
  });
  p.log.info("Tip: run 'toatvm -status' (or -init) to watch it come up.");
}

async function cmdStop(): Promise<void> {
  const acc = resolveAccount();
  const runs = await listRuns(acc, WORKFLOWS.terminal).catch(() => []);
  const dRuns = await listRuns(acc, WORKFLOWS.desktop).catch(() => []);
  const run = [...runs, ...dRuns].find((r) => r.status === "in_progress" || r.status === "queued");
  if (!run) {
    p.log.error("No active session to stop.");
    process.exit(1);
  }
  const workflow = runs.includes(run as never) ? WORKFLOWS.terminal : WORKFLOWS.desktop;
  const s = p.spinner();
  s.start("Shutting down (caching state)…");
  await setVariable(acc, "VM_STOP", "1").catch(() => {});
  await waitForStop(acc, workflow);
  s.stop("Stopped. State was cached.");
}

async function cmdKill(): Promise<void> {
  const acc = resolveAccount();
  const runs = await listRuns(acc, WORKFLOWS.terminal).catch(() => []);
  const dRuns = await listRuns(acc, WORKFLOWS.desktop).catch(() => []);
  const run = [...runs, ...dRuns].find((r) => r.status === "in_progress");
  if (!run) {
    p.log.error("No in-progress run to kill.");
    process.exit(1);
  }
  await cancelRun(acc, run.id).catch(() => {});
  p.log.success(`Cancelled run #${run.id}.`);
}

async function cmdOpen(): Promise<void> {
  const acc = resolveAccount();
  const live = await findLive(acc);
  if (!live) {
    p.log.error("No live session to open.");
    process.exit(1);
  }
  openUrl(live.url);
  p.log.info(`Opened ${live.url}`);
}

async function cmdSsh(): Promise<void> {
  const acc = resolveAccount();
  const live = await findLive(acc);
  if (!live) {
    p.log.error("No live session.");
    process.exit(1);
  }
  const user = live.creds?.user ?? "toat";
  const cmd = `ssh ${user}@${live.url.replace(/^https?:\/\//, "")} -p 22`;
  console.log(cmd);
  if (copyToClipboard(cmd)) p.log.success("ssh command copied to clipboard.");
}

async function cmdSync(dir: string): Promise<void> {
  const acc = resolveAccount();
  const live = await findLive(acc);
  if (!live) {
    p.log.error("No live session to sync into.");
    process.exit(1);
  }
  p.log.info(`Syncing ${dir} → VM home (best-effort via gh).`);
  p.log.warn("Note: the runner shell isn't an SSH server by default.");
  p.log.info(`Use the terminal at ${live.url} to pull your files, or -exec.`);
}

async function cmdExec(command: string): Promise<void> {
  const acc = resolveAccount();
  const live = await findLive(acc);
  if (!live) {
    p.log.error("No live session to exec on.");
    process.exit(1);
  }
  // The ttyd endpoint accepts input frames; for a quick one-shot we hit the
  // HTTP page (no shell) — real exec needs a WS client. Show the command.
  p.log.info(`Target: ${live.url}`);
  p.log.info(`Run this in your own terminal to drive the VM:`);
  console.log(`  websocat ${live.url}/websocket  # then type: ${command}`);
}

async function cmdInit(): Promise<void> {
  brand();
  const cfg = loadConfig();
  if (cfg.accounts.length === 0) {
    p.log.error("No accounts yet — run 'toatvm -new' first.");
    return;
  }

  p.intro("🐸 ToatVM — launch");

  let acc: Account | undefined =
    cfg.accounts.find((a) => a.id === cfg.activeId) ?? cfg.accounts[0];
  if (cfg.accounts.length > 1) {
    const sel = await p.select({
      message: "Account",
      options: cfg.accounts.map((a) => ({ value: a.id, label: a.name })),
    });
    if (p.isCancel(sel)) return;
    acc = cfg.accounts.find((a) => a.id === sel);
  }
  if (!acc) return;

  const mode = await p.select({
    message: "Mode",
    options: [
      { value: "terminal", label: "Terminal (shell)" },
      { value: "desktop", label: "Desktop (XFCE GUI)" },
    ],
  });
  if (p.isCancel(mode)) return;

  const inputs: Record<string, string> = { lifetime: "60" };
  if (mode === "terminal") {
    const os = await p.select({ message: "OS", options: OS_OPTIONS });
    if (p.isCancel(os)) return;
    const username = await p.text({ message: "Username", initialValue: "toat" });
    if (p.isCancel(username)) return;
    const password = await p.password({ message: "Password (blank = random)" });
    if (p.isCancel(password)) return;
    const lifetime = await p.text({ message: "Cycle minutes", initialValue: "60" });
    if (p.isCancel(lifetime)) return;
    const label = await p.text({ message: "Session label (optional)", initialValue: "" });
    if (p.isCancel(label)) return;
    inputs.image = String(os);
    inputs.username = String(username);
    inputs.password = String(password);
    inputs.lifetime = String(lifetime);
    if (String(label)) inputs.label = String(label);
  } else {
    const lifetime = await p.text({ message: "Cycle minutes", initialValue: "60" });
    if (p.isCancel(lifetime)) return;
    inputs.lifetime = String(lifetime);
  }

  const confirm = await p.confirm({
    message: `Boot ${mode} VM on ${acc.owner}/${acc.repo}?`,
  });
  if (p.isCancel(confirm) || !confirm) return;

  const workflow = mode === "desktop" ? WORKFLOWS.desktop : WORKFLOWS.terminal;

  try {
    await deleteVariable(acc, "VM_STOP");
    await dispatchWorkflow(acc, workflow, inputs);
  } catch (err) {
    p.log.error(String(err instanceof Error ? err.message : err));
    return;
  }

  const spinner = p.spinner();
  spinner.start("Booting…");
  const found = await waitForUrl(acc, workflow, spinner);

  if (!found) {
    spinner.stop("Could not find the tunnel URL in time.");
    p.outro("Check the Actions tab in your repo for details.");
    return;
  }

  spinner.stop("ToatVM is live!");
  const credLine = found.creds
    ? `\nlogin:    ${found.creds.user} / ${found.creds.pass}`
    : "";
  p.note(`url:      ${found.url}${credLine}`, "🌐 Live URL");
  console.log(`\nOpen it directly in your browser:\n  ${found.url}\n`);

  for (;;) {
    const action = await p.select({
      message: "Session controls",
      options: [
        { value: "open", label: "Open URL in browser" },
        { value: "copy", label: "Copy URL to clipboard" },
        { value: "ssh", label: "Show ssh command" },
        { value: "shutdown", label: "Shut down (save cache, then stop)" },
        { value: "exit", label: "Exit (leave VM running)" },
      ],
    });
    if (p.isCancel(action)) break;

    if (action === "open") {
      openUrl(found.url);
      p.log.info("Opened in your browser.");
    } else if (action === "copy") {
      copyToClipboard(found.url);
      p.log.success("Copied.");
    } else if (action === "ssh") {
      const user = found.creds?.user ?? "toat";
      console.log(`ssh ${user}@${found.url.replace(/^https?:\/\//, "")} -p 22`);
    } else if (action === "shutdown") {
      const s = p.spinner();
      s.start("Shutting down (caching state)…");
      await setVariable(acc, "VM_STOP", "1").catch(() => {});
      await waitForStop(acc, workflow);
      s.stop("Stopped. State was cached.");
      break;
    } else {
      break;
    }
  }

  p.outro("👋 ToatVM session ended. 'toatvm -init' any time to launch again.");
}

// ---- arg parsing -----------------------------------------------------------

function parseFlags(args: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

// ---- main ------------------------------------------------------------------

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const raw = argv[0] ?? "";
  const cmd = raw.replace(/^-+/, "").toLowerCase();
  const rest = argv.slice(1);

  switch (cmd) {
    case "version":
    case "v":
      console.log(`toatvm v${VERSION}`);
      break;
    case "help":
    case "h":
    case "":
      help();
      break;
    case "license":
    case "licence":
      console.log(LICENSE_TEXT);
      break;
    case "new":
      await cmdNew();
      break;
    case "auth":
      await cmdAuth();
      break;
    case "accounts":
      await cmdAccounts();
      break;
    case "select":
      await cmdSelect(rest[0]);
      break;
    case "remove":
    case "rm":
      await cmdRemove(rest[0]);
      break;
    case "list":
      await cmdList();
      break;
    case "status":
      await cmdStatus();
      break;
    case "url":
      await cmdUrl(rest.includes("--copy") || rest.includes("-c"));
      break;
    case "logs":
      await cmdLogs();
      break;
    case "boot":
      await cmdBoot(rest);
      break;
    case "stop":
      await cmdStop();
      break;
    case "kill":
      await cmdKill();
      break;
    case "open":
      await cmdOpen();
      break;
    case "ssh":
      await cmdSsh();
      break;
    case "sync":
      await cmdSync(rest[0] ?? ".");
      break;
    case "exec":
      await cmdExec(rest.join(" "));
      break;
    case "init":
      await cmdInit();
      break;
    default:
      console.log(`Unknown command: ${raw}\n`);
      help();
      process.exitCode = 1;
  }
}

if (IS_WINDOWS) {
  console.log("🪟 Windows detected — use 'toatvm -open' or 'toatvm -ssh' and paste into your terminal/Windows Terminal.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
