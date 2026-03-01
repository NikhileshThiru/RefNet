import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 4111;
const URL_PREFIX = process.env.URL_PREFIX || '/mastra'; // matches Caddy reverse proxy

// Middleware
app.use(cors({
  origin: '*',
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
app.get(`${URL_PREFIX}/health`, (req, res) => {
  res.json({
    status: 'healthy',
    service: 'RefNet Mastra Backend',
    agent: 'Research Analysis Agent',
    timestamp: new Date().toISOString(),
    openai_configured: !!process.env.OPENAI_API_KEY
  });
});

// Chat endpoint
app.post(`${URL_PREFIX}/chat`, async (req, res) => {
  try {
    const { prompt, additionalContext } = req.body;
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

    // Prepare paper references
    const paperTitles = selectedPapers.map((paper, idx) => 
      `${idx + 1}. "${paper.title || 'Unknown Title'}" by ${paper.authors?.[0] || 'Unknown Author'} (${paper.year || 'Unknown Year'})`
    ).join('\n');

    const systemPrompt = `You are an expert research analyst. You have access to ${selectedPapers.length} selected research paper(s) and can answer questions about them directly.

Your task:
1. Answer the user's question about the selected papers
2. Provide concise insights (under 4 sentences)
3. Write casually and directly
4. Reference specific papers when relevant`;

    const userPrompt = `Selected Papers:
${paperTitles}

User Question: "${prompt}"`;

    // Generate response from OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 300
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

// Optional: serve React frontend if you have one
const frontendPath = path.join(process.cwd(), 'frontend/build');
app.use(URL_PREFIX, express.static(frontendPath));

app.get(`${URL_PREFIX}/*`, (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  res.sendFile(indexPath, err => {
    if (err) res.status(404).json({ error: 'Page not found' });
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mastra backend started on http://0.0.0.0:${PORT}`);
  console.log(`📚 Health check: http://0.0.0.0:${PORT}${URL_PREFIX}/health`);
  console.log(`💬 Chat endpoint: http://0.0.0.0:${PORT}${URL_PREFIX}/chat`);
});