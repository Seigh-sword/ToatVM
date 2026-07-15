import { exec } from "node:child_process";
import { platform } from "node:os";

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function openUrl(url: string): void {
  const p = platform();
  const cmd =
    p === "darwin"
      ? `open "${url}"`
      : p === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}
