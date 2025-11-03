import { kv } from "@vercel/kv";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const count = await kv.incr("visitor_count");
    res.status(200).json({ count });
  } catch (err) {
    console.error("KV error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
