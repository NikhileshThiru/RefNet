"""Main Flask application for RefNet."""

from flask import Flask, jsonify
from datetime import datetime
import os

from refnet.api import search_bp, paper_bp, graph_bp
from config import get_config


def create_app(config_name=None):
    """Create and configure the Flask application."""
    app = Flask(__name__)
    
    # Load configuration
    config_class = get_config(config_name)
    app.config.from_object(config_class)
    
    # Register blueprints
    app.register_blueprint(search_bp, url_prefix='/api')
    app.register_blueprint(paper_bp, url_prefix='/api')
    app.register_blueprint(graph_bp, url_prefix='/api')
    
    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'service': 'RefNet Research Paper Search API',
            'version': '1.0.0',
            'pyalex_version': '0.18'
        })
    
    # Root endpoint with API documentation
    @app.route('/', methods=['GET'])
    def root():
        return jsonify({
            'message': 'RefNet Search API',
            'version': '1.0.0',
            'endpoints': {
                'search': '/api/search?q=your_query&page=1&per_page=25&sort=cited_by_count',
                'paper_details': '/api/paper/<paper_id>',
                'paper_citations': '/api/paper/<paper_id>/citations',
                'paper_references': '/api/paper/<paper_id>/references',
                'build_graph': '/api/graph/<paper_id>?iterations=3&cited_limit=5&ref_limit=5',
                'build_multiple_graph': '/api/graph/multiple (POST)',
                'graph_neighbors': '/api/graph/<paper_id>/neighbors',
                'graph_stats': '/api/graph/stats',
                'graph_data': '/api/graph/data',
                'clear_graph': '/api/graph/clear (POST)',
                'health': '/health'
            },
            'documentation': {
                'search_parameters': {
                    'q': 'Search query (required)',
                    'page': 'Page number (default: 1)',
                    'per_page': 'Results per page (1-50, default: 25)',
                    'sort': 'Sort by: cited_by_count, relevance_score, publication_date (default: cited_by_count)'
                },
                'graph_parameters': {
                    'iterations': 'Number of expansion iterations (1-5, default: 3)',
                    'cited_limit': 'Top cited papers per iteration (1-20, default: 5)',
                    'ref_limit': 'Top reference papers per iteration (1-20, default: 5)'
                }
            }
        })
    
    return app


if __name__ == '__main__':
    # Get configuration from environment
    config_name = os.getenv('FLASK_ENV', 'development')
    app = create_app(config_name)
    
    # Run the application
    app.run(
        debug=app.config['DEBUG'],
        host=app.config['HOST'],
        port=app.config['PORT']
    )
