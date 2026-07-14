// Cloudflare Pages Function: reverse proxy to the ToatVM runner.
//
// The browser never sees the raw *.trycloudflare.com URL. Instead it calls
// /proxy/<base64url(tunnel)>/<path>, and this function forwards the request
// (HTTP for noVNC assets, WebSocket for the terminal / VNC stream) to the
// runner's tunnel. Only *.trycloudflare.com targets are allowed, so this
// can't be abused as an open proxy.

const ALLOWED_SUFFIX = ".trycloudflare.com";

function decodeTarget(enc: string): string | null {
  try {
    const b64 = enc.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const url = atob(padded);
    const u = new URL(url);
    if (!u.hostname.endsWith(ALLOWED_SUFFIX)) return null;
    return url;
  } catch {
    return null;
  }
}

export async function onRequest(context: {
  request: Request;
  params: { path?: string | string[] };
}): Promise<Response> {
  const segs = Array.isArray(context.params.path)
    ? context.params.path
    : context.params.path
      ? [context.params.path]
      : [];

  const target = decodeTarget(segs[0] ?? "");
  if (!target) return new Response("bad target", { status: 400 });

  const reqUrl = new URL(context.request.url);
  const rest = "/" + segs.slice(1).join("/");
  const upstream = new URL(target);
  upstream.pathname = rest || "/";
  upstream.search = reqUrl.search;

  const upgrade = context.request.headers.get("Upgrade");
  if (upgrade && upgrade.toLowerCase() === "websocket") {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.accept();
    const up = new WebSocket(upstream.toString());

    up.addEventListener("message", (e) => server.send((e as MessageEvent).data));
    server.addEventListener("message", (e) =>
      up.send((e as MessageEvent).data),
    );
    server.addEventListener("close", () => up.close());
    up.addEventListener("close", () => server.close());
    up.addEventListener("error", () => server.close());

    return new Response(null, { status: 101, webSocket: client });
  }

  const upstreamReq = new Request(upstream.toString(), {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
    redirect: "follow",
  });
  return fetch(upstreamReq);
}
