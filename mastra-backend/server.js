import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '../.env' });

const app = express();
const port = 4111;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());

// Check for OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment variables');
  console.error('Please create a .env file in the project root with:');
  console.error('OPENAI_API_KEY=your_openai_api_key_here');
  process.exit(1);
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'RefNet Mastra Backend',
    agent: 'Research Analysis Agent',
    timestamp: new Date().toISOString(),
    openai_configured: !!process.env.OPENAI_API_KEY
  });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { prompt, additionalContext } = req.body;
    
    console.log('🔍 Research Agent executing:', prompt);
    console.log('📄 Selected papers:', additionalContext?.selectedPapers?.length || 0);
    
    // Extract paper data from context
    const selectedPapers = additionalContext?.selectedPapers || [];
    const graphData = additionalContext?.graphData || {};
    
    if (selectedPapers.length === 0) {
      return res.json({
        content: "I don't see any research papers selected. Please select some papers in the graph interface first, then ask me to analyze them.",
        metadata: {
          agent: 'research',
          status: 'no_papers'
        }
      });
    }
    
    // Create a comprehensive context for the AI
    const papersContext = selectedPapers.map((paper, index) => `
Paper ${index + 1}:
- Title: ${paper.title || 'Unknown'}
- Authors: ${paper.authors?.join(', ') || 'Unknown'}
- Year: ${paper.year || 'Unknown'}
- Citations: ${paper.citations || 0}
- Topics: ${paper.topics?.join(', ') || 'Not specified'}
- Abstract: ${paper.abstract || 'No abstract available'}
`).join('\n');

    const systemPrompt = `You are an expert research analyst. You have been given ${selectedPapers.length} research paper(s) to analyze. 

Your task is to:
1. Provide a comprehensive analysis of the selected papers
2. Answer the user's specific question about these papers
3. Identify key findings, methodologies, and contributions
4. Compare and contrast the papers if multiple are selected
5. Highlight relationships and patterns between the papers
6. Provide insights and recommendations

Be thorough, analytical, and evidence-based in your response.`;

    const userPrompt = `Here are the ${selectedPapers.length} selected research paper(s):

${papersContext}

Graph Context:
- Total nodes in network: ${graphData.totalNodes || 0}
- Total connections: ${graphData.totalLinks || 0}

User Question: "${prompt}"

Please provide a detailed analysis addressing the user's question.`;

    // Use OpenAI to generate the analysis
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const analysis = response.choices[0].message.content;

    res.json({
      content: analysis,
      metadata: {
        agent: 'research',
        papers_analyzed: selectedPapers.length,
        analysis_type: selectedPapers.length === 1 ? 'single' : 'comparative'
      }
    });

  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({
      error: `I encountered an error while analyzing the papers: ${error.message}. Please try again.`
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log('🚀 Mastra backend started on http://localhost:4111');
  console.log('📚 Research Analysis Agent ready');
  console.log('🔗 Health check: http://localhost:4111/health');
  console.log('💬 Chat endpoint: http://localhost:4111/chat');
});