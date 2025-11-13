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
    // Get team ID and project ID from environment variables
    const teamId = process.env.VERCEL_TEAM_ID;
    const projectId = process.env.VERCEL_PROJECT_ID;
    const token = process.env.VERCEL_API_TOKEN;

    if (!token || !teamId || !projectId) {
      return res.status(500).json({ 
        error: 'Missing configuration',
        count: 0 
      });
    }

    // Call Vercel Analytics API
    const analyticsUrl = `https://api.vercel.com/v1/analytics/${teamId}/${projectId}/views`;
    
    const response = await fetch(analyticsUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Analytics API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Sum up all views
    const totalViews = data.views?.reduce((sum: number, item: any) => sum + (item.count || 0), 0) || 0;

    return res.status(200).json({ count: totalViews });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch analytics',
      count: 0 
    });
  }
}