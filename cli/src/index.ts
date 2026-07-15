#!/usr/bin/env node
import * as p from "@clack/prompts";
import {
  Account,
  deleteVariable,
  dispatchWorkflow,
  findRunInfo,
  getVariable,
  listRuns,
  loadConfig,
  saveConfig,
  setVariable,
} from "./api.js";
import { BANNER } from "./banner.js";
import { LICENSE_TEXT } from "./license.js";
import { openUrl, sleep } from "./util.js";
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
  console.log(`\n${BANNER}
${"🐸 ToatVM CLI".padEnd(0)} v${VERSION}

A virtual machine that runs inside GitHub Actions runners.
Experimental — not for permanent or production use.

Usage:
  toatvm -init            Launch the interactive VM wizard (boot / control)
  toatvm -new             Create a new account (saved locally)
  toatvm -auth            Save / update a token for an account
  toatvm -accounts        List saved accounts
  toatvm -version         Print version
  toatvm -license         Print the license
  toatvm -help            Show this help

Accounts are stored at ~/.config/toatvm/config.json.
The PAT needs 'repo' + 'workflow' scopes.
`);
}

function brand(): void {
  console.log(BANNER);
}

async function cmdNew(): Promise<void> {
  brand();
  p.intro("🐸 ToatVM — new account");
  const name = await p.text({ message: "Account name" });
  if (p.isCancel(name)) return;
  const owner = await p.text({ message: "GitHub owner" });
  if (p.isCancel(owner)) return;
  const repo = await p.text({ message: "Repository" });
  if (p.isCancel(repo)) return;
  const token = await p.password({
    message: "Personal Access Token (repo + workflow)",
  });
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

function cmdAccounts(): void {
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

async function waitForUrl(
  acc: Account,
  workflow: string,
  spinner: ReturnType<typeof p.spinner>,
): Promise<{ url: string; creds: { user: string; pass: string } | null } | null> {
  for (let i = 0; i < 72; i++) {
    spinner.message(`Booting… (${i * 5}s) looking for tunnel URL`);
    const runs = await listRuns(acc, workflow).catch(() => []);
    const active = runs.find(
      (r) => r.status === "in_progress" || r.status === "queued",
    );
    if (active) {
      const info = await findRunInfo(acc, active.id).catch(() => null);
      if (info?.url) return { url: info.url, creds: info.creds };
    }
    await sleep(5000);
  }
  return null;
}

async function waitForStop(acc: Account, workflow: string): Promise<void> {
  for (let i = 0; i < 36; i++) {
    const runs = await listRuns(acc, workflow).catch(() => []);
    const active = runs.find((r) => r.status === "in_progress");
    if (!active) return;
    await sleep(5000);
  }
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
    const username = await p.text({
      message: "Username",
      initialValue: "toat",
    });
    if (p.isCancel(username)) return;
    const password = await p.password({
      message: "Password (blank = random)",
    });
    if (p.isCancel(password)) return;
    const lifetime = await p.text({
      message: "Cycle minutes",
      initialValue: "60",
    });
    if (p.isCancel(lifetime)) return;
    inputs.image = String(os);
    inputs.username = String(username);
    inputs.password = String(password);
    inputs.lifetime = String(lifetime);
  } else {
    const lifetime = await p.text({
      message: "Cycle minutes",
      initialValue: "60",
    });
    if (p.isCancel(lifetime)) return;
    inputs.lifetime = String(lifetime);
  }

  const confirm = await p.confirm({
    message: `Boot ${mode} VM on ${acc.owner}/${acc.repo}?`,
  });
  if (p.isCancel(confirm) || !confirm) return;

  const workflow = mode === "desktop" ? "vm-desktop.yml" : "vm.yml";

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
  console.log(`\nYou can open it directly:\n  ${found.url}\n`);

  // Control loop
  for (;;) {
    const action = await p.select({
      message: "Session controls",
      options: [
        { value: "open", label: "Open URL in browser" },
        { value: "shutdown", label: "Shut down (save cache, then stop)" },
        { value: "exit", label: "Exit (leave VM running)" },
      ],
    });
    if (p.isCancel(action)) break;

    if (action === "open") {
      openUrl(found.url);
      p.log.info("Opened in your browser.");
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

async function main(): Promise<void> {
  const raw = process.argv.slice(2)[0] ?? "";
  const cmd = raw.replace(/^-+/, "").toLowerCase();

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
      cmdAccounts();
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

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
