import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("dist"));

const GITHUB_API = "https://api.github.com";

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function ghFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...ghHeaders(token), ...(init?.headers ?? {}) },
  });
  return res;
}

const TUNNEL_RE = /https:\/\/[a-z0-9.-]+\.trycloudflare\.com/;
const CRED_RE = /ToatVM credentials: user=(\S+) pass=(\S+)/;

async function findUrlAndCreds(
  owner: string,
  repo: string,
  token: string,
  runId: number,
): Promise<{ url: string | null; creds: { user: string; pass: string } | null }> {
  const jobsRes = await ghFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=20`,
    token,
  );
  if (!jobsRes.ok) return { url: null, creds: null };

  const jobs = (await jobsRes.json()) as { jobs?: { logs_url: string }[] };
  let url: string | null = null;
  let creds: { user: string; pass: string } | null = null;

  for (const job of jobs.jobs ?? []) {
    try {
      const logRes = await ghFetch(job.logs_url, token);
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

app.post("/api/boot", async (req, res) => {
  const {
    owner,
    repo,
    token,
    mode,
    image,
    username,
    cycle,
    label,
    env,
    preRun,
    postRun,
    cpuLimit,
    memLimit,
    diskSize,
    ports,
  } = req.body ?? {};

  if (!owner || !repo || !token) {
    return res.status(400).json({ error: "owner, repo, and token are required" });
  }

  const workflow = mode === "desktop" ? "vm-desktop.yml" : "vm.yml";

  const inputs: Record<string, string> = {
    lifetime: String(cycle ?? "60"),
    env: JSON.stringify(env ?? {}),
    "pre-run": preRun ?? "",
    "post-run": postRun ?? "",
    "cpu-limit": cpuLimit ?? "1",
    "mem-limit": memLimit ?? "2",
    "disk-size": diskSize ?? "10",
  };

  if (mode === "terminal") {
    inputs.image = image ?? "ubuntu:latest";
    inputs.username = username ?? "toat";
    inputs.password = "";
  } else {
    inputs.geometry = "1280x720";
  }

  if (label) inputs.label = label;
  if (ports) inputs.ports = String(ports);

  const ghRes = await ghFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ ref: "main", inputs }),
    },
  );

  if (!ghRes.ok) {
    const body = await ghRes.text();
    return res.status(ghRes.status).json({ error: `dispatch failed (${ghRes.status}): ${body}` });
  }

  res.json({ success: true, workflow });
});

app.get("/api/status", async (req, res) => {
  const { owner, repo, token } = req.query as Record<string, string>;

  if (!owner || !repo || !token) {
    return res.status(400).json({ error: "owner, repo, and token are required" });
  }

  const workflows = ["vm.yml", "vm-desktop.yml"];
  let runningRun: { id: number; workflow: string } | null = null;

  for (const wf of workflows) {
    const runsRes = await ghFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${wf}/runs?per_page=5`,
      token,
    );
    if (!runsRes.ok) continue;

    const data = (await runsRes.json()) as { workflow_runs?: { id: number; status: string }[] };
    const run = data.workflow_runs?.find((r) => r.status === "in_progress" || r.status === "queued");
    if (run) {
      runningRun = { id: run.id, workflow: wf };
      break;
    }
  }

  if (!runningRun) {
    return res.json({ running: false, url: null, creds: null });
  }

  const { url, creds } = await findUrlAndCreds(owner, repo, token, runningRun.id);

  res.json({ running: true, url, creds, runId: runningRun.id });
});

app.post("/api/stop", async (req, res) => {
  const { owner, repo, token } = req.body ?? {};

  if (!owner || !repo || !token) {
    return res.status(400).json({ error: "owner, repo, and token are required" });
  }

  const setRes = await ghFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/variables/VM_STOP`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({ name: "VM_STOP", value: "1" }),
    },
  );

  if (!setRes.ok && setRes.status !== 409) {
    const body = await setRes.text();
    return res.status(setRes.status).json({ error: `stop failed (${setRes.status}): ${body}` });
  }

  res.json({ success: true });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`ToatCloud proxy running on :${PORT}`);
});
