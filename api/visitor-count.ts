import type { VercelRequest, VercelResponse } from '@vercel/node';

// This will persist across requests but reset on cold starts
// For a production solution, you'd want to use Vercel KV or a database
let visitorCount = 0;
const visitors = new Set<string>();

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET' || req.method === 'POST') {
    // Get visitor identifier (IP address as a simple unique identifier)
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const visitorId = Array.isArray(ip) ? ip[0] : ip;

    // Check if this is a new visitor
    if (!visitors.has(visitorId)) {
      visitors.add(visitorId);
      visitorCount++;
    }

    return res.status(200).json({ 
      count: visitorCount,
      uniqueVisitors: visitors.size 
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}