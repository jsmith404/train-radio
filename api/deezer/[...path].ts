import type { VercelRequest, VercelResponse } from "@vercel/node";

// Production mirror of the dev proxy in vite.config.ts:
//   /api/deezer/<path>?<query> → https://api.deezer.com/<path>?<query>
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const segs = req.query.path;
  const path = Array.isArray(segs) ? segs.join("/") : (segs ?? "");
  const url = new URL(`https://api.deezer.com/${path}`);
  for (const [k, v] of Object.entries(req.query)) {
    if (k === "path" || v === undefined) continue;
    url.searchParams.set(k, Array.isArray(v) ? v[0] : v);
  }

  try {
    const upstream = await fetch(url);
    res
      .status(upstream.status)
      .setHeader("content-type", upstream.headers.get("content-type") ?? "application/json")
      .setHeader("cache-control", "s-maxage=300, stale-while-revalidate=3600")
      .send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).json({ error: "deezer upstream failed" });
  }
}
