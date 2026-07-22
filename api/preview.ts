import type { VercelRequest, VercelResponse } from "@vercel/node";

const PREVIEW_HOST = /(^|\.)dzcdn\.net$/;

// Production mirror of the dev proxy in vite.config.ts:
//   /api/preview?url=<dzcdn url> → streams the 30s MP3 (Range-aware)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const target = typeof req.query.url === "string" ? req.query.url : undefined;
  if (!target) return res.status(400).json({ error: "missing ?url=" });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).json({ error: "invalid url" });
  }
  if (parsed.protocol !== "https:" || !PREVIEW_HOST.test(parsed.hostname)) {
    return res.status(403).json({ error: "only dzcdn.net preview urls are allowed" });
  }

  try {
    const range = req.headers.range;
    const upstream = await fetch(parsed, {
      headers: range ? { range } : undefined,
    });
    res.status(upstream.status);
    res.setHeader("accept-ranges", "bytes");
    res.setHeader("cache-control", "s-maxage=86400");
    for (const h of ["content-type", "content-length", "content-range"]) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).json({ error: "preview upstream failed" });
  }
}
