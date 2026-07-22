import { defineConfig, type Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

const DEEZER_API = "https://api.deezer.com";
// Deezer 30s previews live on cdn(s|t)-preview-*.dzcdn.net
const PREVIEW_HOST = /(^|\.)dzcdn\.net$/;

async function pipeUpstream(
  upstream: Response,
  res: ServerResponse,
  passHeaders: string[],
) {
  res.statusCode = upstream.status;
  for (const h of passHeaders) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  if (upstream.body) {
    Readable.fromWeb(upstream.body as never).pipe(res);
  } else {
    res.end();
  }
}

function sendError(res: ServerResponse, status: number, message: string) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ error: message }));
}

/**
 * Dev-only proxy mirroring the Vercel functions in /api:
 *   /api/deezer/<path>?<query>  → https://api.deezer.com/<path>?<query>
 *   /api/preview?url=<dzcdn url> → streams the 30s MP3 (Range-aware)
 */
function deezerProxy(): Plugin {
  return {
    name: "deezer-proxy",
    configureServer(server) {
      server.middlewares.use(
        "/api/deezer",
        async (req: IncomingMessage, res: ServerResponse) => {
          try {
            const upstream = await fetch(DEEZER_API + (req.url ?? "/"));
            await pipeUpstream(upstream, res, ["content-type"]);
          } catch {
            sendError(res, 502, "deezer upstream failed");
          }
        },
      );

      server.middlewares.use(
        "/api/preview",
        async (req: IncomingMessage, res: ServerResponse) => {
          const target = new URL(req.url ?? "", "http://localhost")
            .searchParams.get("url");
          if (!target) return sendError(res, 400, "missing ?url=");
          let parsed: URL;
          try {
            parsed = new URL(target);
          } catch {
            return sendError(res, 400, "invalid url");
          }
          if (parsed.protocol !== "https:" || !PREVIEW_HOST.test(parsed.hostname)) {
            return sendError(res, 403, "only dzcdn.net preview urls are allowed");
          }
          try {
            const range = req.headers.range;
            const upstream = await fetch(parsed, {
              headers: range ? { range } : undefined,
            });
            res.setHeader("accept-ranges", "bytes");
            await pipeUpstream(upstream, res, [
              "content-type",
              "content-length",
              "content-range",
            ]);
          } catch {
            sendError(res, 502, "preview upstream failed");
          }
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [deezerProxy()],
});
