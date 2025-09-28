export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Forward the request to your backend
    const { q, page = 1, per_page = 25, sort = 'cited_by_count' } = req.query;
    
    const backendUrl = `http://3.142.93.250:8000/api/search?q=${encodeURIComponent(q)}&page=${page}&per_page=${per_page}&sort=${sort}`;
    
    const response = await fetch(backendUrl);
    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
