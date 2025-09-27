"""Chat API routes for RefNet."""

from flask import Blueprint, request, jsonify
import os
from datetime import datetime

chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/chat', methods=['POST'])
def chat_with_papers():
    """Chat endpoint - now handled by Mastra backend."""
    return jsonify({
        'error': 'This endpoint is deprecated. Please use the Mastra backend at http://localhost:4111/chat',
        'mastra_backend_url': 'http://localhost:4111/chat',
        'status': 'deprecated'
    }), 410

@chat_bp.route('/chat/health', methods=['GET'])
def chat_health():
    """Health check for chat service."""
    return jsonify({
        'status': 'deprecated',
        'service': 'RefNet Chat API (Deprecated)',
        'message': 'Chat functionality moved to Mastra backend',
        'mastra_backend_url': 'http://localhost:4111/chat',
        'mastra_health_url': 'http://localhost:4111/health',
        'timestamp': datetime.now().isoformat()
    })
