import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple in-memory counter (resets on cold starts)
// For production, use Vercel KV, Redis, or a database
let visitorCount = 0;

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    // Increment and return count
    visitorCount++;
    return res.status(200).json({ count: visitorCount });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}