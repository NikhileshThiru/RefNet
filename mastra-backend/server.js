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
        content: "No papers selected. Select some papers first, then ask me about them.",
        metadata: {
          agent: 'research',
          status: 'no_papers'
        }
      });
    }

    // Check if user is requesting paper generation
    const generatePapersMatch = prompt.match(/(?:generate|add|find|get)\s+(\d+)?\s*(?:more\s+)?(?:similar\s+)?papers?/i);
    console.log('🔍 Paper generation regex match:', generatePapersMatch);
    console.log('🔍 Original prompt:', prompt);
    
    if (generatePapersMatch) {
      const requestedCount = generatePapersMatch[1] ? parseInt(generatePapersMatch[1]) : 5;
      const maxCount = Math.min(requestedCount, 20); // Cap at 20 papers
      
      console.log('🔍 Requested count:', requestedCount);
      console.log('🔍 Max count:', maxCount);
      
      return res.json({
        content: `I'll add ${maxCount} similar papers to your graph.`,
        metadata: {
          agent: 'research',
          action: 'generate_papers',
          count: maxCount,
          selectedPapers: selectedPapers.length,
          discoveryType: 'similar'
        }
      });
    }
    
    // Create a concise paper reference for the AI
    const paperTitles = selectedPapers.map((paper, index) => 
      `${index + 1}. "${paper.title || 'Unknown Title'}" by ${paper.authors?.[0] || 'Unknown Author'} (${paper.year || 'Unknown Year'})`
    ).join('\n');

    const systemPrompt = `You are an expert research analyst. You have access to ${selectedPapers.length} selected research paper(s) and can answer questions about them directly.

Your task is to:
1. Answer the user's specific question about the selected papers
2. Be EXTREMELY concise - keep responses under 2 sentences
3. Write like a text message - casual, direct, and brief
4. Reference specific papers when relevant
5. Focus on key insights only

Be direct, analytical, and evidence-based. Keep responses short and conversational.`;

    const userPrompt = `Selected Papers:
${paperTitles}

User Question: "${prompt}"

Please answer the user's question about these papers directly and concisely. Keep your response under 2 sentences and write like a text message.`;

    // Use OpenAI to generate the analysis
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 150
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
      error: `Error analyzing papers: ${error.message}. Try again.`
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