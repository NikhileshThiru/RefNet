import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.refnet.wiki/flask/api';
const MASTRA_BASE_URL = process.env.REACT_APP_MASTRA_URL || 'https://api.refnet.wiki/mastra';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const searchAPI = {
  // Search for research papers
  searchPapers: async (query, page = 1, perPage = 25, sortBy = 'cited_by_count') => {
    const params = {
      q: query,
      page,
      per_page: perPage,
      sort: sortBy
    };
    
    const response = await api.get('/search', { params });
    return response.data;
  }
};

export const paperAPI = {
  // Get paper details by ID
  getPaper: async (paperId) => {
    const response = await api.get(`/paper/${paperId}`);
    return response.data;
  },

  // Get paper citations
  getCitations: async (paperId) => {
    const response = await api.get(`/paper/${paperId}/citations`);
    return response.data;
  },

  // Get paper references
  getReferences: async (paperId) => {
    const response = await api.get(`/paper/${paperId}/references`);
    return response.data;
  }
};

export const graphAPI = {
  // Build graph from a paper
  buildGraph: async (paperId, iterations = 3, citedLimit = 5, refLimit = 5) => {
    const params = {
      iterations,
      cited_limit: citedLimit,
      ref_limit: refLimit
    };
    
    const response = await api.get(`/graph/${paperId}`, { params });
    return response.data;
  },

  // Build graph from multiple papers
  buildMultipleGraph: async (paperIds, iterations = 3, citedLimit = 5, refLimit = 5) => {
    const data = {
      root_paper_ids: paperIds,
      iterations,
      cited_limit: citedLimit,
      ref_limit: refLimit
    };
    
    const response = await api.post('/graph/multiple', data);
    return response.data;
  },

  // Get graph data
  getData: async () => {
    const response = await api.get('/graph/data');
    return response.data;
  },

  // Clear graph
  clearGraph: async () => {
    const response = await api.post('/graph/clear');
    return response.data;
  },

  // Add AI-discovered papers to the graph
  addAIDiscoveredPapers: async (existingGraph, newPapers) => {
    const data = {
      existing_graph: existingGraph,
      ai_discovered_papers: newPapers
    };
    
    const response = await api.post('/graph/add-ai-papers', data);
    return response.data;
  },

  // Merge papers into existing graph with AI context
  mergePapersWithContext: async (papers, context = {}) => {
    const data = {
      papers: papers,
      context: context,
      merge_strategy: 'ai_enhanced'
    };
    
    const response = await api.post('/graph/merge-ai-papers', data);
    return response.data;
  },

  // Get AI analysis for a paper
  getAIAnalysis: async (paperId, graphContext = {}) => {
    const params = {
      paper_id: paperId,
      graph_context: JSON.stringify(graphContext)
    };
    
    const response = await api.get('/graph/ai-analysis', { params });
    return response.data;
  }
};

export const chatAPI = {
  // Send message to multi-agent system
  sendMessage: async (message, selectedPapers = [], graphData = {}) => {
    const data = {
      message,
      selectedPapers,
      graphData
    };
    
    // Use Mastra endpoint for chat
    const response = await fetch(`${MASTRA_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  },

  // Get chat health status
  getHealth: async () => {
    const response = await fetch(`${MASTRA_BASE_URL}/health`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  }
};

export default api;
