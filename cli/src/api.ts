import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const GITHUB_API = "https://api.github.com";
const CONFIG_DIR = join(homedir(), ".config", "toatvm");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export interface Account {
  id: string;
  name: string;
  token: string;
  owner: string;
  repo: string;
}

interface Config {
  accounts: Account[];
  activeId: string | null;
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

export interface VmCredentials {
  user: string;
  pass: string;
}

export interface RunLogLine {
  job: string;
  text: string;
}

function defaultConfig(): Config {
  return { accounts: [], activeId: null };
}

export function loadConfig(): Config {
  try {
    if (!existsSync(CONFIG_PATH)) return defaultConfig();
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<Config>;
    return {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      activeId: parsed.activeId ?? null,
    };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(cfg: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export async function listRuns(
  acc: Account,
  workflow: string,
): Promise<WorkflowRun[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${acc.owner}/${acc.repo}/actions/workflows/${workflow}/runs?per_page=10`,
    { headers: headers(acc.token) },
  );
  if (!res.ok) throw new Error(`listRuns failed (${res.status})`);
  const data = (await res.json()) as {
    workflow_runs: (Omit<WorkflowRun, "name"> & { name?: string })[];
  };
  return (data.workflow_runs ?? []).map((r) => ({
    id: r.id,
    name: r.name ?? workflow,
    status: r.status,
    conclusion: r.conclusion,
    html_url: r.html_url,
    created_at: r.created_at,
  }));
}

export async function dispatchWorkflow(
  acc: Account,
  workflow: string,
  inputs: Record<string, string> = {},
): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/repos/${acc.owner}/${acc.repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: headers(acc.token),
      body: JSON.stringify({ ref: "main", inputs }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`dispatch failed (${res.status}): ${body}`);
  }
}

export async function cancelRun(acc: Account, runId: number): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/repos/${acc.owner}/${acc.repo}/actions/runs/${runId}/cancel`,
    { method: "POST", headers: headers(acc.token) },
  );
  if (!res.ok && res.status !== 409)
    throw new Error(`cancel failed (${res.status})`);
}

export async function setVariable(
  acc: Account,
  name: string,
  value: string,
): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/repos/${acc.owner}/${acc.repo}/actions/variables/${name}`,
    {
      method: "PUT",
      headers: headers(acc.token),
      body: JSON.stringify({ name, value }),
    },
  );
  if (!res.ok && res.status !== 409) {
    throw new Error(`setVariable failed (${res.status})`);
  }
}

export async function deleteVariable(
  acc: Account,
  name: string,
): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/repos/${acc.owner}/${acc.repo}/actions/variables/${name}`,
    { method: "DELETE", headers: headers(acc.token) },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteVariable failed (${res.status})`);
  }
}

export async function getVariable(
  acc: Account,
  name: string,
): Promise<string | null> {
  const res = await fetch(
    `${GITHUB_API}/repos/${acc.owner}/${acc.repo}/actions/variables/${name}`,
    { headers: headers(acc.token) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getVariable failed (${res.status})`);
  const data = (await res.json()) as { value: string };
  return data.value ?? null;
}

const TUNNEL_RE = /https:\/\/[a-z0-9.-]+\.trycloudflare\.com/;
const CRED_RE = /ToatVM credentials: user=(\S+) pass=(\S+)/;

// Read the VM_URL and credentials the runner printed into the run's job logs.
export async function findRunInfo(
  acc: Account,
  runId: number,
): Promise<{ url: string | null; creds: VmCredentials | null }> {
  const jobsRes = await fetch(
    `${GITHUB_API}/repos/${acc.owner}/${acc.repo}/actions/runs/${runId}/jobs?per_page=20`,
    { headers: headers(acc.token) },
  );
  if (!jobsRes.ok) return { url: null, creds: null };
  const jobs = (await jobsRes.json()) as { jobs?: { logs_url: string }[] };
  let url: string | null = null;
  let creds: VmCredentials | null = null;
  for (const job of jobs.jobs ?? []) {
    try {
      const logRes = await fetch(job.logs_url, { headers: headers(acc.token) });
      if (!logRes.ok) continue;
      const text = await logRes.text();
      if (!url) {
        const m = text.match(TUNNEL_RE);
        if (m) url = m[0];
      }
      if (!creds) {
        const c = text.match(CRED_RE);
        if (c) creds = { user: c[1], pass: c[2] };
      }
      if (url && creds) break;
    } catch {
      // try next job
    }
  }
  return { url, creds };
}

// Fetch raw job logs for `toatvm -logs`.
export async function getRunLogs(
  acc: Account,
  runId: number,
): Promise<RunLogLine[]> {
  const jobsRes = await fetch(
    `${GITHUB_API}/repos/${acc.owner}/${acc.repo}/actions/runs/${runId}/jobs?per_page=20`,
    { headers: headers(acc.token) },
  );
  if (!jobsRes.ok) return [];
  const jobs = (await jobsRes.json()) as { jobs?: { name: string; logs_url: string }[] };
  const out: RunLogLine[] = [];
  for (const job of jobs.jobs ?? []) {
    try {
      const logRes = await fetch(job.logs_url, { headers: headers(acc.token) });
      if (!logRes.ok) continue;
      const text = await logRes.text();
      out.push({ job: job.name, text });
    } catch {
      // skip
    }
  }
  return out;
}

export const WORKFLOWS = {
  terminal: "vm.yml",
  desktop: "vm-desktop.yml",
} as const;
