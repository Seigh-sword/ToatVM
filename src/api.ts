// 
// The browser talks directly to api.github.com using the user's own
// Personal Access Token (PAT). We never send the token anywhere except
// GitHub. The token needs REPO and WORKFLOW scopes so it can trigger
// and inspect the ToatVM GitHub Actions workflow.
//
// See https://docs.github.com/rest for the underlying endpoints.

const GITHUB_API = "https://api.github.com";

export interface GitHubAuth {
  token: string;
  owner: string;
  repo: string;
}

export const AUTH_KEY = "toatvm.auth";

export function saveAuth(auth: GitHubAuth): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function loadAuth(): GitHubAuth | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GitHubAuth>;
    if (parsed.token && parsed.owner && parsed.repo) {
      return parsed as GitHubAuth;
    }
    return null;
  } catch {
    return null;
  }
}

function headers(auth: GitHubAuth): Record<string, string> {
  return {
    Authorization: `Bearer ${auth.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export interface RepoVariable {
  name: string;
  value: string;
}

export async function getVariable(
  auth: GitHubAuth,
  name: string,
): Promise<string | null> {
  const res = await fetch(
    `${GITHUB_API}/repos/${auth.owner}/${auth.repo}/actions/variables/${name}`,
    { headers: headers(auth) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to read variable ${name}: ${res.status}`);
  const data = (await res.json()) as RepoVariable;
  return data.value ?? null;
}

export interface WorkflowRun {
  id: number;
  status: string; 
  conclusion: string | null;
  created_at: string;
  html_url: string;
}

export async function listRuns(
  auth: GitHubAuth,
  workflowFile: string,
): Promise<WorkflowRun[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${auth.owner}/${auth.repo}/actions/workflows/${workflowFile}/runs?per_page=5`,
    { headers: headers(auth) },
  );
  if (!res.ok) throw new Error(`Failed to list runs: ${res.status}`);
  const data = (await res.json()) as { workflow_runs: WorkflowRun[] };
  return data.workflow_runs ?? [];
}

export async function dispatchWorkflow(
  auth: GitHubAuth,
  workflowFile: string,
  inputs: Record<string, string> = {},
): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/repos/${auth.owner}/${auth.repo}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: "POST",
      headers: headers(auth),
      body: JSON.stringify({ ref: "main", inputs }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to boot VM (${res.status}): ${body}`);
  }
}

export async function cancelRun(auth: GitHubAuth, runId: number): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/repos/${auth.owner}/${auth.repo}/actions/runs/${runId}/cancel`,
    { method: "POST", headers: headers(auth) },
  );
  if (!res.ok) throw new Error(`Failed to cancel run (${res.status})`);
}
