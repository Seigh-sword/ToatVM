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

export const IS_WINDOWS = platform() === "win32";

export function copyToClipboard(text: string): boolean {
  try {
    if (IS_WINDOWS) exec(`powershell -NoProfile -Command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'"`, () => {});
    else exec(`echo '${text.replace(/'/g, "'\\''")}' | pbcopy`, () => {});
    return true;
  } catch {
    return false;
  }
}
