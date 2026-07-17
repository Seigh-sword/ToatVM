#!/usr/bin/env node
import * as p from "@clack/prompts";
import {
  Account,
  cancelRun,
  deleteVariable,
  dispatchWorkflow,
  findRunInfo,
  getVariable,
  listRuns,
  loadConfig,
  saveConfig,
  setVariable,
  WORKFLOWS,
} from "./api.js";
import { copyToClipboard, IS_WINDOWS, openUrl, sleep } from "./util.js";
import { VERSION } from "./version.js";

const OS_OPTIONS = [
  { value: "ubuntu:latest", label: "Ubuntu" },
  { value: "debian:latest", label: "Debian" },
  { value: "archlinux:latest", label: "Arch Linux" },
  { value: "alpine:latest", label: "Alpine" },
  { value: "fedora:latest", label: "Fedora" },
  { value: "kalilinux/kali-rolling", label: "Kali" },
];

function help(): void {
  console.log(`ToatVM Lite v${VERSION}

Minimal web-focused CLI for GitHub Actions VMs.

COMMANDS
  -init            Boot a VM and show the live URL
  -new             Create a new account (saved locally)
  -url [--copy]    Print (or copy) the live tunnel URL
  -open            Open the live URL in your browser
  -status          Show the current session if live
  -stop            Gracefully stop the active session
  -version         Print version
  -help            Show this help

GLOBAL FLAGS
  --account <name>  Use this account
  --mode <t|d>      terminal or desktop
  --os <image>      e.g. ubuntu:latest
  --user <name>     shell username
  --pass <pw>       shell password (random if blank)
  --cycle <min>     minutes per cycle (default 60)

Config: ~/.config/toatvm/config.json
`);
}

function resolveAccount(name?: string): Account {
  const cfg = loadConfig();
  const accounts = cfg.accounts;
  if (accounts.length === 0) {
    console.log("No accounts. Run 'toatvm-lite -new' to add one.");
    process.exit(1);
  }
  const id = name ?? cfg.activeId ?? accounts[0].id;
  const acc = accounts.find((a) => a.id === id || a.name === name);
  if (!acc) {
    console.log(`Account "${name ?? cfg.activeId}" not found.`);
    process.exit(1);
  }
  return acc;
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
    spinner.message(`Booting... (${i * 5}s)`);
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

async function cmdNew(): Promise<void> {
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
  p.outro(`Account "${name}" saved. Run 'toatvm-lite -init' to launch.`);
}

async function cmdInit(args: string[]): Promise<void> {
  const flags = parseFlags(args);
  const acc = resolveAccount(flags.account);
  const mode = (flags.mode === "d" ? "desktop" : "terminal") as "terminal" | "desktop";
  const workflow = mode === "desktop" ? WORKFLOWS.desktop : WORKFLOWS.terminal;
  const inputs: Record<string, string> = { lifetime: flags.cycle ?? "60" };
  if (mode === "terminal") {
    inputs.image = flags.os ?? "ubuntu:latest";
    inputs.username = flags.user ?? "toat";
    inputs.password = flags.pass ?? "";
  } else {
    inputs.geometry = flags.geometry ?? "1280x720";
  }

  try {
    await deleteVariable(acc, "VM_STOP");
    await dispatchWorkflow(acc, workflow, inputs);
  } catch (err) {
    p.log.error(String(err instanceof Error ? err.message : err));
    process.exit(1);
  }

  const s = p.spinner();
  s.start("Booting...");
  const found = await waitForUrl(acc, workflow, s);

  if (!found) {
    s.stop("Could not find the tunnel URL in time.");
    p.outro("Check the Actions tab in your repo for details.");
    return;
  }

  s.stop("ToatVM is live!");
  const credLine = found.creds ? `\nlogin:    ${found.creds.user} / ${found.creds.pass}` : "";
  p.note(`url:      ${found.url}${credLine}`, "Live URL");
  console.log(`\nOpen it directly in your browser:\n  ${found.url}\n`);
  p.outro("Session is running. Use 'toatvm-lite -url' to get the URL anytime.");
}

async function cmdUrl(copy: boolean): Promise<void> {
  const acc = resolveAccount();
  const live = await findLive(acc);
  if (!live) {
    p.log.error("No live session right now.");
    process.exit(1);
  }
  if (copy) {
    copyToClipboard(live.url);
    p.log.success(`Copied: ${live.url}`);
  } else {
    console.log(live.url);
  }
}

async function cmdOpen(): Promise<void> {
  const acc = resolveAccount();
  const live = await findLive(acc);
  if (!live) {
    p.log.error("No live session right now.");
    process.exit(1);
  }
  openUrl(live.url);
  p.log.success(`Opened ${live.url}`);
}

async function cmdStatus(): Promise<void> {
  const acc = resolveAccount();
  const live = await findLive(acc);
  if (!live) {
    console.log("No live session right now.");
    return;
  }
  console.log(`\nLive URL: ${live.url}`);
  if (live.creds) console.log(`login:      ${live.creds.user} / ${live.creds.pass}`);
  console.log(`run:        ${acc.owner}/${acc.repo} #${live.runId}`);
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
  s.start("Shutting down...");
  await setVariable(acc, "VM_STOP", "1").catch(() => {});
  await waitForStop(acc, workflow);
  s.stop("Stopped.");
}

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

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const raw = argv[0] ?? "";
  const cmd = raw.replace(/^-+/, "").toLowerCase();
  const rest = argv.slice(1);

  switch (cmd) {
    case "version":
    case "v":
      console.log(`toatvm-lite v${VERSION}`);
      break;
    case "help":
    case "h":
    case "":
      help();
      break;
    case "new":
      await cmdNew();
      break;
    case "init":
      await cmdInit(rest);
      break;
    case "url":
      await cmdUrl(rest.includes("--copy") || rest.includes("-c"));
      break;
    case "open":
      await cmdOpen();
      break;
    case "status":
      await cmdStatus();
      break;
    case "stop":
      await cmdStop();
      break;
    default:
      console.log(`Unknown command: ${raw}\n`);
      help();
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
