// Helpers for routing the browser to the runner *through* the ToatVM site
// instead of exposing the raw *.trycloudflare.com URL. The runner's tunnel
// URL is base64url-encoded into the path so the same-origin proxy can
// forward both the terminal WebSocket and noVNC to it.

export function encodeTarget(target: string): string {
  return btoa(target)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function proxyWs(target: string): string {
  return `/proxy/${encodeTarget(target)}/websocket`;
}

export function proxyDesktop(target: string): string {
  return `/proxy/${encodeTarget(target)}/vnc.html?path=websockify&resize=scale&autoconnect=true`;
}
