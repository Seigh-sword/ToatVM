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
export const IS_MAC = platform() === "darwin";

// Best-effort clipboard copy (used by -url copy).
export function copyToClipboard(text: string): boolean {
  try {
    if (IS_WINDOWS) exec(`powershell -NoProfile -Command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'"`, () => {});
    else if (IS_MAC) exec(`echo '${text.replace(/'/g, "'\\''")}' | pbcopy`, () => {});
    else exec(`echo '${text.replace(/'/g, "'\\''")}' | xclip -selection clipboard`, () => {});
    return true;
  } catch {
    return false;
  }
}

// Open the user's default terminal emulator to a command (Windows support).
export function openTerminal(command: string): void {
  const p = platform();
  if (p === "win32") {
    // Windows Terminal / conhost with the command.
    exec(`start cmd /k "${command}"`, () => {});
  } else if (p === "darwin") {
    exec(`osascript -e 'tell app "Terminal" to do script "${command}"'`, () => {});
  } else {
    exec(`x-terminal-emulator -e "${command}"`, () => {});
  }
}

export function homedir(): string {
  return require("node:os").homedir();
}
