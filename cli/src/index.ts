#!/usr/bin/env node
import * as p from "@clack/prompts";
import {
  Account,
  cancelRun,
  deleteTemplate,
  deleteVariable,
  dispatchWorkflow,
  findRunInfo,
  getRunHealth,
  getRunLogs,
  getVariable,
  listRuns,
  listTemplates,
  loadConfig,
  saveConfig,
  saveTemplate,
  setVariable,
  Template,
  WORKFLOWS,
} from "./api.js";
import { BANNER } from "./banner.js";
import { LICENSE_TEXT } from "./license.js";
import { copyToClipboard, IS_WINDOWS, openTerminal, openUrl, sleep } from "./util.js";
import { ttydRun } from "./ttyd.js";
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
${"ToatVM CLI".padEnd(0)} v${VERSION}

A virtual machine that runs inside GitHub Actions runners.
Experimental - not for permanent or production use.

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
  -sync <dir>      Upload a local folder into the VM ($HOME/sync) over the tunnel
  -share [pw]      Password-protect the shared tunnel (ttyd basic auth)
  -unshare         Remove the share password
  -exec "<cmd>"    Run a command on the live VM over the tunnel
  -template        Save, list, apply, or delete session templates
  -port            Manage port forwards for the active session
  -env             Manage environment variables for the next boot
  -health          Check the health of the active or a recent run
  -history         Show detailed session history with status
  -import <file>   Import accounts from a JSON file
  -export [file]   Export accounts to a JSON file
  -cleanup         Clean up old workflow runs
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
  --env <json>      environment variables as JSON object
  --pre-run <cmd>   shell command to run inside VM on boot
  --post-run <cmd>  shell command to run inside VM after cycle
  --ports <list>    comma-separated host:container ports (e.g. 8080:80,3000:3000)
  --cpu <cores>     CPU limit for the container
  --mem <gb>        Memory limit for the container
  --disk <gb>       Disk size for the container

Accounts are stored at ~/.config/toatvm/config.json.
The PAT needs 'repo' + 'workflow' scopes.
Templates are stored at ~/.config/toatvm/templates/.
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
): Promise<{
  url: string;
  creds: { user: string; pass: string } | null;
  sharePass: string | null;
  runId: number;
} | null> {
  const runs = await listRuns(acc, WORKFLOWS.terminal).catch(() => []);
  const term = runs.find((r) => r.status === "in_progress" || r.status === "queued");
  const wf = term ? WORKFLOWS.terminal : WORKFLOWS.desktop;
  const runs2 = term ? runs : await listRuns(acc, wf).catch(() => []);
  const run = runs2.find((r) => r.status === "in_progress" || r.status === "queued");
  if (!run) return null;
  const info = await findRunInfo(acc, run.id).catch(() => null);
  if (!info?.url) return null;
  const sharePass = await getVariable(acc, "VM_PASS").catch(() => null);
  return { url: info.url, creds: info.creds, sharePass, runId: run.id };
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
  p.intro("ToatVM - new account");
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
  p.intro("ToatVM - auth");
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
      r.status === "in_progress" ? "running" : r.status === "queued" ? "queued" : `${r.conclusion ?? r.status}`;
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
  console.log(`\nLive URL: ${live.url}`);
  if (live.creds) console.log(`login:      ${live.creds.user} / ${live.creds.pass}`);
  console.log(`run:        ${acc.owner}/${acc.repo} #${live.runId}`);
  const health = await getRunHealth(acc, live.runId).catch(() => null);
  if (health) {
    console.log(`health:     ${health.status}`);
    for (const job of health.jobs) {
      console.log(`  job ${job.name}: ${job.status} (${job.conclusion ?? "running"})`);
    }
  }
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
  env: Record<string, string>;
  preRun: string;
  postRun: string;
  ports: string[];
  cpu: string;
  mem: string;
  disk: string;
  geometry?: string;
}): Promise<void> {
  const acc = resolveAccount(opts.account);
  const workflow = opts.mode === "desktop" ? WORKFLOWS.desktop : WORKFLOWS.terminal;
  const inputs: Record<string, string> = {
    lifetime: opts.cycle,
    env: JSON.stringify(opts.env),
    preRun: opts.preRun,
    postRun: opts.postRun,
    cpuLimit: opts.cpu,
    memLimit: opts.mem,
    diskSize: opts.disk,
  };
  if (opts.mode === "terminal") {
    inputs.image = opts.os;
    inputs.username = opts.username;
    inputs.password = opts.password;
  } else {
    inputs.geometry = opts.geometry ?? "1280x720";
  }
  if (opts.label) inputs.label = opts.label;
  if (opts.ports.length > 0) inputs.ports = opts.ports.join(",");
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
      await setVariable(acc, "VM_LABEL", opts.label).catch(() => {});
    }
  }
}

async function cmdBoot(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const env = parseEnvJson(flags.env ?? "{}");
  const ports = (flags.ports ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  await boot({
    account: flags.account,
    mode: (flags.mode === "d" ? "desktop" : "terminal") as "terminal" | "desktop",
    os: flags.os ?? "ubuntu:latest",
    username: flags.user ?? "toat",
    password: flags.pass ?? "",
    cycle: flags.cycle ?? "60",
    label: flags.name,
    env,
    preRun: flags.preRun ?? "",
    postRun: flags.postRun ?? "",
    ports,
    cpu: flags.cpu ?? "1",
    mem: flags.mem ?? "2",
    disk: flags.disk ?? "10",
    geometry: flags.geometry,
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
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const target = path.resolve(dir);
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    p.log.error(`Not a directory: ${target}`);
    process.exit(1);
  }
  const s = p.spinner();
  s.start(`Packing ${target} …`);
  let b64: string;
  try {
    const tar = execFileSync("tar", ["-czf", "-", "-C", target, "."], {
      maxBuffer: 64 * 1024 * 1024,
    });
    b64 = tar.toString("base64");
  } catch (e) {
    s.stop("Failed to pack files.");
    p.log.error(String(e instanceof Error ? e.message : e));
    process.exit(1);
  }
  s.message("Uploading to VM over the tunnel…");

  // Build a shell script that decodes stdin and extracts into the home dir.
  const script =
    `mkdir -p "$HOME/sync" && base64 -d | tar -xzf - -C "$HOME/sync" && ` +
    `echo TOATVM_SYNC_DONE_$RANDOM`;
  // Send base64 in 4KB chunks to avoid oversized frames.
  const chunkSize = 4096;
  let uploaded = 0;
  let lastPct = 0;
  const marker = "TOATVM_SYNC_DONE_";
  let result: { output: string; ok: boolean };
  try {
    result = await ttydRun(live.url, "", { timeoutMs: 60000 });
    // prime the shell
    void result;
    // Now stream chunks
    let out = "";
    let wsUrl = live.url.replace(/\/$/, "") + "/websocket";
    if (live.sharePass) {
      const u = new URL(wsUrl);
      u.username = "toat";
      u.password = live.sharePass;
      wsUrl = u.toString();
    }
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((res) => (ws.onopen = () => res()));
    const rf = new TextEncoder().encode(JSON.stringify({ cols: 200, rows: 40 }));
    const rframe = new Uint8Array(1 + rf.length);
    rframe[0] = 1;
    rframe.set(rf, 1);
    ws.send(rframe);
    const sendFrame = (txt: string) => {
      const pld = new TextEncoder().encode(txt);
      const f = new Uint8Array(1 + pld.length);
      f[0] = 0;
      f.set(pld, 1);
      ws.send(f);
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") {
        out += new TextDecoder().decode(new Uint8Array(ev.data as ArrayBuffer).subarray(1));
      }
    };
    await new Promise((r) => setTimeout(r, 300));
    sendFrame(script + "\n");
    await new Promise((r) => setTimeout(r, 300));
    for (let i = 0; i < b64.length; i += chunkSize) {
      sendFrame(b64.slice(i, i + chunkSize) + "\n");
      uploaded = i + chunkSize;
      const pct = Math.floor((uploaded / b64.length) * 100);
      if (pct - lastPct >= 10) {
        lastPct = pct;
        s.message(`Uploading… ${pct}%`);
      }
      if (out.includes(marker)) break;
    }
    // close the pipe (end of base64) so tar finishes
    sendFrame("\n");
    await new Promise((r) => setTimeout(r, 2000));
    ws.close();
    result = { output: out, ok: out.includes(marker) };
  } catch (e) {
    s.stop("Upload failed.");
    p.log.error(String(e instanceof Error ? e.message : e));
    process.exit(1);
  }
  s.stop(result.ok ? "Synced." : "Sync finished (could not confirm).");
  if (!result.ok) p.log.warn("Upload sent, but the completion marker wasn't seen. Check the VM.");
  else p.log.success(`Synced ${dir} → VM:$HOME/sync`);
}

async function cmdShare(pw: string): Promise<void> {
  const acc = resolveAccount();
  if (!pw) {
    const entered = await p.password({ message: "Share password" });
    if (p.isCancel(entered)) return;
    pw = String(entered);
  }
  await setVariable(acc, "VM_PASS", pw).catch(() => {});
  // If a session is already running, restart it so ttyd picks up auth.
  const runs = await listRuns(acc, WORKFLOWS.terminal).catch(() => []);
  const run = runs.find((r) => r.status === "in_progress" || r.status === "queued");
  if (run) {
    await setVariable(acc, "VM_STOP", "1").catch(() => {});
    p.log.info("Restarting current session to apply the share password…");
    await waitForStop(acc, WORKFLOWS.terminal);
    const inputs: Record<string, string> = { lifetime: "60" };
    await dispatchWorkflow(acc, WORKFLOWS.terminal, inputs).catch(() => {});
  }
  p.log.success("Sharing enabled. The tunnel now requires the password.");
  p.log.info("Share the URL; people connect with user 'toat' and your password.");
}

async function cmdUnshare(): Promise<void> {
  const acc = resolveAccount();
  await deleteVariable(acc, "VM_PASS").catch(() => {});
  const runs = await listRuns(acc, WORKFLOWS.terminal).catch(() => []);
  const run = runs.find((r) => r.status === "in_progress" || r.status === "queued");
  if (run) {
    await setVariable(acc, "VM_STOP", "1").catch(() => {});
    p.log.info("Restarting current session without the share password…");
    await waitForStop(acc, WORKFLOWS.terminal);
    await dispatchWorkflow(acc, WORKFLOWS.terminal, { lifetime: "60" }).catch(() => {});
  }
  p.log.success("Sharing disabled. The tunnel is open again.");
}

async function cmdExec(command: string): Promise<void> {
  const acc = resolveAccount();
  const live = await findLive(acc);
  if (!live) {
    p.log.error("No live session to exec on.");
    process.exit(1);
  }
  if (!command) {
    p.log.error("Provide a command: toatvm -exec \"uname -a\"");
    process.exit(1);
  }
  const s = p.spinner();
  s.start("Running on VM...");
  const res = await ttydRun(live.url, command + "\n", {
    expect: "$",
    timeoutMs: 25000,
    password: live.sharePass,
  }).catch(() => null);
  s.stop("Done.");
  if (res) console.log(res.output.trim());
  else p.log.warn("No output captured.");
}

function parseEnvJson(jsonStr: string): Record<string, string> {
  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof k === "string" && typeof v === "string") out[k] = v;
      }
      return out;
    }
  } catch {
    // ignore
  }
  return {};
}

function buildInputs(opts: {
  mode: "terminal" | "desktop";
  os: string;
  username: string;
  password: string;
  cycle: string;
  label?: string;
  env: Record<string, string>;
  preRun: string;
  postRun: string;
  ports: string[];
  cpu: string;
  mem: string;
  disk: string;
  geometry?: string;
}): Record<string, string> {
  const inputs: Record<string, string> = {
    lifetime: opts.cycle,
    env: JSON.stringify(opts.env),
    "pre-run": opts.preRun,
    "post-run": opts.postRun,
    "cpu-limit": opts.cpu,
    "mem-limit": opts.mem,
    "disk-size": opts.disk,
  };
  if (opts.mode === "terminal") {
    inputs.image = opts.os;
    inputs.username = opts.username;
    inputs.password = opts.password;
  } else {
    inputs.geometry = opts.geometry ?? "1280x720";
  }
  if (opts.label) inputs.label = opts.label;
  if (opts.ports.length > 0) inputs.ports = opts.ports.join(",");
  return inputs;
}

// ---- templates -------------------------------------------------------------

async function cmdTemplate(args: string[]): Promise<void> {
  brand();
  const action = args[0];
  if (!action || action === "list") {
    const templates = listTemplates();
    if (templates.length === 0) {
      console.log("No templates saved. Use 'toatvm -template save <name>' to create one.");
      return;
    }
    console.log("\nTemplates:");
    for (const t of templates) {
      console.log(`- ${t.id}: ${t.name} (${t.mode}${t.os ? ", " + t.os : ""})`);
    }
    return;
  }
  if (action === "save") {
    const name = args[1];
    if (!name) {
      p.log.error("Usage: toatvm -template save <name>");
      return;
    }
    const mode = await p.select({
      message: "Mode",
      options: [
        { value: "terminal", label: "Terminal (shell)" },
        { value: "desktop", label: "Desktop (XFCE GUI)" },
      ],
    });
    if (p.isCancel(mode)) return;
    const os = mode === "terminal"
      ? await p.select({ message: "OS", options: OS_OPTIONS })
      : undefined;
    if (mode === "terminal" && p.isCancel(os)) return;
    const username = await p.text({ message: "Username", initialValue: "toat" });
    if (p.isCancel(username)) return;
    const password = await p.password({ message: "Password (blank = random)" });
    if (p.isCancel(password)) return;
    const cycle = await p.text({ message: "Cycle minutes", initialValue: "60" });
    if (p.isCancel(cycle)) return;
    const envJson = await p.text({ message: "Env vars (JSON)", initialValue: "{}" });
    if (p.isCancel(envJson)) return;
    const preRun = await p.text({ message: "Pre-run script", initialValue: "" });
    if (p.isCancel(preRun)) return;
    const postRun = await p.text({ message: "Post-run script", initialValue: "" });
    if (p.isCancel(postRun)) return;
    const portsStr = await p.text({ message: "Ports (host:container,...)", initialValue: "" });
    if (p.isCancel(portsStr)) return;
    const cpu = await p.text({ message: "CPU limit (cores)", initialValue: "1" });
    if (p.isCancel(cpu)) return;
    const mem = await p.text({ message: "Memory limit (GB)", initialValue: "2" });
    if (p.isCancel(mem)) return;
    const disk = await p.text({ message: "Disk size (GB)", initialValue: "10" });
    if (p.isCancel(disk)) return;

    const tpl: Template = {
      id: crypto.randomUUID(),
      name: String(name),
      mode: mode as "terminal" | "desktop",
      os: mode === "terminal" ? String(os) : undefined,
      username: String(username),
      password: String(password),
      cycle: String(cycle),
      env: parseEnvJson(envJson),
      preRun: String(preRun),
      postRun: String(postRun),
      ports: String(portsStr).split(",").map((s) => s.trim()).filter(Boolean),
      cpu: String(cpu),
      mem: String(mem),
      disk: String(disk),
      createdAt: new Date().toISOString(),
    };
    saveTemplate(tpl);
    p.outro(`Template "${name}" saved.`);
    return;
  }
  if (action === "delete") {
    const id = args[1];
    if (!id) {
      p.log.error("Usage: toatvm -template delete <id>");
      return;
    }
    const templates = listTemplates();
    const tpl = templates.find((t) => t.id === id || t.name === id);
    if (!tpl) {
      p.log.error("Template not found.");
      return;
    }
    deleteTemplate(tpl.id);
    p.log.success(`Deleted template "${tpl.name}".`);
    return;
  }
  if (action === "apply") {
    const id = args[1];
    if (!id) {
      p.log.error("Usage: toatvm -template apply <id>");
      return;
    }
    const templates = listTemplates();
    const tpl = templates.find((t) => t.id === id || t.name === id);
    if (!tpl) {
      p.log.error("Template not found.");
      return;
    }
    const acc = resolveAccount();
    const workflow = tpl.mode === "desktop" ? WORKFLOWS.desktop : WORKFLOWS.terminal;
    const inputs = buildInputs({
      mode: tpl.mode,
      os: tpl.os ?? "ubuntu:latest",
      username: tpl.username,
      password: tpl.password,
      cycle: tpl.cycle,
      env: tpl.env,
      preRun: tpl.preRun,
      postRun: tpl.postRun,
      ports: tpl.ports,
      cpu: tpl.cpu,
      mem: tpl.mem,
      disk: tpl.disk,
      geometry: tpl.geometry,
    });
    try {
      await deleteVariable(acc, "VM_STOP");
      await dispatchWorkflow(acc, workflow, inputs);
    } catch (err) {
      p.log.error(String(err instanceof Error ? err.message : err));
      process.exit(1);
    }
    p.log.success(`Applied template "${tpl.name}" on ${acc.owner}/${acc.repo}.`);
    return;
  }
  p.log.error("Unknown template action. Use: save, list, apply, delete");
}

// ---- ports ---------------------------------------------------------------

async function cmdPort(args: string[]): Promise<void> {
  brand();
  const action = args[0];
  if (!action || action === "list") {
    console.log("\nPort forwards are stored in session templates and passed as workflow inputs.");
    console.log("Use 'toatvm -template save' to include ports in a template.");
    const live = await findLive(resolveAccount()).catch(() => null);
    if (live) {
      console.log(`\nLive URL: ${live.url}`);
      console.log("Port forwards would be exposed via the tunnel URL (cloudflared maps all ports).");
    }
    return;
  }
  if (action === "add") {
    const mapping = args[1];
    if (!mapping || !mapping.includes(":")) {
      p.log.error("Usage: toatvm -port add <host:container>");
      return;
    }
    p.log.info(`Port ${mapping} will be forwarded on next boot via template.`);
    p.log.info("Save a template with this port mapping: toatvm -template save <name>");
    return;
  }
  p.log.error("Unknown port action. Use: list, add");
}

// ---- env ------------------------------------------------------------------

async function cmdEnv(args: string[]): Promise<void> {
  brand();
  const action = args[0];
  if (!action || action === "list") {
    const acc = resolveAccount();
    const vars = await getVariable(acc, "VM_ENV_KEYS").catch(() => null);
    console.log("\nEnvironment variables are set per-boot via --env JSON.");
    if (vars) console.log(`Stored keys: ${vars}`);
    else console.log("No env vars stored in repo variables.");
    return;
  }
  if (action === "set") {
    const pair = args[1];
    if (!pair || !pair.includes("=")) {
      p.log.error("Usage: toatvm -env set KEY=VALUE");
      return;
    }
    const [k, v] = pair.split("=", 2);
    const acc = resolveAccount();
    const current = (await getVariable(acc, "VM_ENV_KEYS").catch(() => null)) ?? "";
    const keys = new Set(current.split(",").filter(Boolean));
    keys.add(k);
    await setVariable(acc, "VM_ENV_KEYS", Array.from(keys).join(",")).catch(() => {});
    await setVariable(acc, `VM_ENV_${k}`, v).catch(() => {});
    p.log.success(`Set env ${k}=${v}`);
    return;
  }
  if (action === "delete") {
    const key = args[1];
    if (!key) {
      p.log.error("Usage: toatvm -env delete KEY");
      return;
    }
    const acc = resolveAccount();
    await deleteVariable(acc, `VM_ENV_${key}`).catch(() => {});
    const current = (await getVariable(acc, "VM_ENV_KEYS").catch(() => null)) ?? "";
    const keys = current.split(",").filter((k) => k && k !== key).join(",");
    await setVariable(acc, "VM_ENV_KEYS", keys).catch(() => {});
    p.log.success(`Deleted env ${key}`);
    return;
  }
  p.log.error("Unknown env action. Use: list, set, delete");
}

// ---- health ---------------------------------------------------------------

async function cmdHealth(runId?: number): Promise<void> {
  brand();
  const acc = resolveAccount();
  let targetRunId = runId;
  if (!targetRunId) {
    const live = await findLive(acc);
    if (!live) {
      p.log.error("No live session and no run ID provided.");
      process.exit(1);
    }
    targetRunId = live.runId;
  }
  const health = await getRunHealth(acc, targetRunId);
  if (!health) {
    p.log.error(`Could not fetch health for run #${targetRunId}.`);
    process.exit(1);
  }
  console.log(`\nRun #${targetRunId}: ${health.status}`);
  for (const job of health.jobs) {
    const icon = job.status === "completed" ? (job.conclusion === "success" ? "[ok]" : "[!!]") : "[..]";
    console.log(`  ${icon} ${job.name}: ${job.status} (${job.conclusion ?? "running"})`);
  }
}

// ---- history --------------------------------------------------------------

async function cmdHistory(): Promise<void> {
  brand();
  const acc = resolveAccount();
  const runs = await listRuns(acc, WORKFLOWS.terminal).catch(() => []);
  const dRuns = await listRuns(acc, WORKFLOWS.desktop).catch(() => []);
  const all = [...runs, ...dRuns].sort((a, b) => b.id - a.id).slice(0, 20);
  console.log(`\nSession history for ${acc.owner}/${acc.repo}:`);
  console.log(`  ID       Status        Workflow    Created`);
  console.log(`  -------  ------------  ----------  -------`);
  for (const r of all) {
    const date = new Date(r.created_at).toLocaleString();
    const wf = r.name.includes("desktop") || r.name.includes("vm-desktop") ? "desktop" : "terminal";
    console.log(`  #${String(r.id).padEnd(7)} ${(r.status ?? "unknown").padEnd(13)} ${wf.padEnd(11)} ${date}`);
  }
}

// ---- import / export -------------------------------------------------------

async function cmdImport(file: string): Promise<void> {
  brand();
  const fs = await import("node:fs");
  const path = await import("node:path");
  const target = path.resolve(file);
  if (!fs.existsSync(target)) {
    p.log.error(`File not found: ${target}`);
    return;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(target, "utf8"));
    if (!Array.isArray(raw.accounts)) {
      p.log.error("Invalid import: expected { accounts: [...] }");
      return;
    }
    const cfg = loadConfig();
    for (const a of raw.accounts as Account[]) {
      if (!a.name || !a.owner || !a.repo || !a.token) continue;
      const existing = cfg.accounts.find((x) => x.owner === a.owner && x.repo === a.repo);
      if (existing) {
        existing.token = a.token;
        existing.name = a.name;
      } else {
        cfg.accounts.push({ ...a, id: crypto.randomUUID() });
      }
    }
    if (!cfg.activeId && cfg.accounts.length > 0) cfg.activeId = cfg.accounts[0].id;
    saveConfig(cfg);
    p.outro(`Imported ${raw.accounts.length} accounts.`);
  } catch (e) {
    p.log.error(`Import failed: ${e instanceof Error ? e.message : e}`);
  }
}

async function cmdExport(file?: string): Promise<void> {
  brand();
  const cfg = loadConfig();
  const target = file ?? `${process.env.USERPROFILE ?? process.env.HOME ?? "~"}/.config/toatvm/toatvm-export.json`;
  const fs = await import("node:fs");
  const out = {
    version: VERSION,
    exportedAt: new Date().toISOString(),
    accounts: cfg.accounts.map(({ token, ...rest }) => rest),
  };
  fs.writeFileSync(target, JSON.stringify(out, null, 2));
  p.outro(`Exported ${cfg.accounts.length} accounts to ${target}`);
}

// ---- cleanup --------------------------------------------------------------

async function cmdCleanup(): Promise<void> {
  brand();
  const acc = resolveAccount();
  let deleted = 0;
  for (const wf of [WORKFLOWS.terminal, WORKFLOWS.desktop]) {
    const runs = await listRuns(acc, wf).catch(() => []);
    const toCancel = runs.filter((r) => r.status === "in_progress" || r.status === "queued");
    for (const r of toCancel) {
      await cancelRun(acc, r.id).catch(() => {});
      deleted++;
    }
  }
  p.outro(`Cleaned up ${deleted} active runs.`);
}

async function cmdInit(): Promise<void> {
  brand();
  const cfg = loadConfig();
  if (cfg.accounts.length === 0) {
    p.log.error("No accounts yet - run 'toatvm -new' first.");
    return;
  }

  p.intro(" ToatVM - launch");

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

  const inputs: Record<string, string> = { lifetime: "60", env: "{}", preRun: "", postRun: "", cpuLimit: "1", memLimit: "2", diskSize: "10" };
  if (mode === "terminal") {
    const os = await p.select({ message: "OS", options: OS_OPTIONS });
    if (p.isCancel(os)) return;
    const username = await p.text({ message: "Username", initialValue: "toat" });
    if (p.isCancel(username)) return;
    const password = await p.password({ message: "Password (blank = random)" });
    if (p.isCancel(password)) return;
    inputs.image = String(os);
    inputs.username = String(username);
    inputs.password = String(password);
  }
  const lifetime = await p.text({ message: "Cycle minutes", initialValue: "60" });
  if (p.isCancel(lifetime)) return;
  inputs.lifetime = String(lifetime);

  const envJson = await p.text({ message: "Env vars (JSON)", initialValue: "{}" });
  if (p.isCancel(envJson)) return;
  inputs.env = String(envJson);

  const preRun = await p.text({ message: "Pre-run script", initialValue: "" });
  if (p.isCancel(preRun)) return;
  inputs.preRun = String(preRun);

  const postRun = await p.text({ message: "Post-run script", initialValue: "" });
  if (p.isCancel(postRun)) return;
  inputs.postRun = String(postRun);

  const portsStr = await p.text({ message: "Ports (host:container,...)", initialValue: "" });
  if (p.isCancel(portsStr)) return;
  const ports = String(portsStr).split(",").map((s) => s.trim()).filter(Boolean);
  if (ports.length > 0) inputs.ports = ports.join(",");

  const cpu = await p.text({ message: "CPU limit (cores)", initialValue: "1" });
  if (p.isCancel(cpu)) return;
  inputs.cpuLimit = String(cpu);

  const mem = await p.text({ message: "Memory limit (GB)", initialValue: "2" });
  if (p.isCancel(mem)) return;
  inputs.memLimit = String(mem);

  const disk = await p.text({ message: "Disk size (GB)", initialValue: "10" });
  if (p.isCancel(disk)) return;
  inputs.diskSize = String(disk);

  if (mode === "desktop") {
    const geometry = await p.text({ message: "VNC geometry", initialValue: "1280x720" });
    if (p.isCancel(geometry)) return;
    inputs.geometry = String(geometry);
  }

  const label = await p.text({ message: "Session label (optional)", initialValue: "" });
  if (p.isCancel(label)) return;
  if (String(label)) inputs.label = String(label);

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
  spinner.start("Booting...");
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
  p.note(`url:      ${found.url}${credLine}`, "Live URL");
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
      s.start("Shutting down (caching state)...");
      await setVariable(acc, "VM_STOP", "1").catch(() => {});
      await waitForStop(acc, workflow);
      s.stop("Stopped. State was cached.");
      break;
    } else {
      break;
    }
  }

  p.outro("ToatVM session ended. 'toatvm -init' any time to launch again.");
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
    case "history":
      await cmdHistory();
      break;
    case "status":
      await cmdStatus();
      break;
    case "health":
      await cmdHealth(rest[0] ? Number(rest[0]) : undefined);
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
    case "share":
      await cmdShare(rest[0]);
      break;
    case "unshare":
      await cmdUnshare();
      break;
    case "exec":
      await cmdExec(rest.join(" "));
      break;
    case "template":
      await cmdTemplate(rest);
      break;
    case "port":
      await cmdPort(rest);
      break;
    case "env":
      await cmdEnv(rest);
      break;
    case "import":
      await cmdImport(rest[0] ?? "toatvm-import.json");
      break;
    case "export":
      await cmdExport(rest[0]);
      break;
    case "cleanup":
      await cmdCleanup();
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
  console.log("Windows detected — use 'toatvm -open' or 'toatvm -ssh' and paste into your terminal/Windows Terminal.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
