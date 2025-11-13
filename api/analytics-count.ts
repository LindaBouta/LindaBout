import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const teamId = process.env.VERCEL_TEAM_ID || 'team_nD2bci00idbqzYclEwlCMHT2';
    const projectId = process.env.VERCEL_PROJECT_ID || 'prj_sfd7VUTew35JJBE23omf8i268sGp';
    const token = process.env.VERCEL_API_TOKEN || '1mPatKzTOP9WxXfgYFW64geC';

    if (!token) {
      console.error('Missing VERCEL_API_TOKEN');
      return res.status(200).json({ count: 0 });
    }

    // Get analytics data from Vercel
    const since = Date.now() - (30 * 24 * 60 * 60 * 1000); // Last 30 days
    const analyticsUrl = `https://api.vercel.com/v1/analytics?projectId=${projectId}&teamId=${teamId}&since=${since}`;
    
    const response = await fetch(analyticsUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error(`Analytics API error: ${response.status}`);
      return res.status(200).json({ count: 0 });
    }

    const data = await response.json();
    
    // Calculate total visitors
    const totalVisitors = data.visitors || data.total || 0;

    return res.status(200).json({ count: totalVisitors });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(200).json({ count: 0 });
  }
}