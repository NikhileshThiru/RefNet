"""Chat API routes for RefNet."""

from flask import Blueprint, request, jsonify
import openai
import os
from datetime import datetime

chat_bp = Blueprint('chat', __name__)

# Initialize OpenAI client
openai.api_key = os.getenv('OPENAI_API_KEY')

@chat_bp.route('/chat', methods=['POST'])
def chat_with_papers():
    """Chat endpoint for discussing selected research papers."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        message = data.get('message', '')
        selected_papers = data.get('selectedPapers', [])
        graph_data = data.get('graphData', {})
        
        if not message:
            return jsonify({'error': 'No message provided'}), 400
        
        if not selected_papers:
            return jsonify({'error': 'No papers selected'}), 400
        
        # Create context from selected papers
        papers_context = []
        for paper in selected_papers:
            paper_info = {
                'title': paper.get('title', 'Untitled'),
                'authors': paper.get('authors', []),
                'year': paper.get('year', 'Unknown'),
                'citations': paper.get('citations', 0),
                'topics': paper.get('topics', []),
                'abstract': paper.get('abstract', '')
            }
            papers_context.append(paper_info)
        
        # Create system prompt for research paper analysis
        system_prompt = f"""You are an AI research assistant helping with literature review and research paper analysis. 
        
You have access to {len(selected_papers)} selected research papers with the following information:
{chr(10).join([f"- {p['title']} by {', '.join(p['authors'][:3])} ({p['year']}) - {p['citations']} citations" for p in papers_context])}

Graph context:
- Total nodes: {graph_data.get('totalNodes', 0)}
- Total connections: {graph_data.get('totalLinks', 0)}

Your role is to help analyze these papers, find patterns, similarities, differences, and provide insights that would be useful for literature review. You can:
1. Compare and contrast the selected papers
2. Identify common themes and topics
3. Analyze citation patterns and influence
4. Suggest research gaps or opportunities
5. Help organize papers by methodology, findings, or other criteria
6. Answer specific questions about the papers

Be thorough but concise in your analysis. Focus on providing actionable insights for research."""

        # Prepare the user message with context
        user_message = f"""Selected Papers Context:
{chr(10).join([f"• {p['title']} ({p['year']}) - {p['citations']} citations" for p in papers_context])}

User Question: {message}"""

        # Make API call to OpenAI
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            max_tokens=1000,
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content
        
        return jsonify({
            'response': ai_response,
            'timestamp': datetime.now().isoformat(),
            'papers_analyzed': len(selected_papers)
        })
        
    except openai.error.OpenAIError as e:
        return jsonify({'error': f'OpenAI API error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@chat_bp.route('/chat/health', methods=['GET'])
def chat_health():
    """Health check for chat service."""
    return jsonify({
        'status': 'healthy',
        'service': 'RefNet Chat API',
        'openai_configured': bool(os.getenv('OPENAI_API_KEY')),
        'timestamp': datetime.now().isoformat()
    })
