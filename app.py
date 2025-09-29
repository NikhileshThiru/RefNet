"""Main Flask application for RefNet."""

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime
import os

from refnet.api import search_bp, paper_bp, graph_bp
from config import get_config


def create_app(config_name=None, url_prefix='/flask'):
    """
    Create and configure the Flask application.
    url_prefix: Prefix used by reverse proxy (Caddy)
    """
    app = Flask(__name__, static_folder='refnet/frontend/build', static_url_path='')
    
    # Load configuration
    config_class = get_config(config_name)
    app.config.from_object(config_class)
    
    # Enable CORS for API calls
    CORS(app, origins=['*'])
    
    # Register blueprints with proper prefix for reverse proxy
    app.register_blueprint(search_bp, url_prefix=f'{url_prefix}/api')
    app.register_blueprint(paper_bp, url_prefix=f'{url_prefix}/api')
    app.register_blueprint(graph_bp, url_prefix=f'{url_prefix}/api')
    
    # Health check endpoint
    @app.route(f'{url_prefix}/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'service': 'RefNet Research Paper Search API',
            'version': '1.0.0',
            'pyalex_version': '0.18'
        })
    
    # Serve React app for all non-API routes
    @app.route(f'{url_prefix}/', defaults={'path': ''})
    @app.route(f'{url_prefix}/<path:path>')
    def serve_react_app(path):
        if path.startswith('api/'):
            # Let API routes be handled by blueprints
            return jsonify({'error': 'API endpoint not found'}), 404
        
        # Serve React app for all other routes
        index_path = os.path.join(app.static_folder, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(app.static_folder, 'index.html')
        else:
            # Fallback JSON if frontend not built
            return jsonify({
                'message': 'RefNet Search API',
                'version': '1.0.0',
                'note': 'Frontend not built. Run "npm run build" in refnet/frontend/',
                'endpoints': {
                    'search': f'{url_prefix}/api/search?q=your_query&page=1&per_page=25&sort=cited_by_count',
                    'paper_details': f'{url_prefix}/api/paper/<paper_id>',
                    'paper_citations': f'{url_prefix}/api/paper/<paper_id>/citations',
                    'paper_references': f'{url_prefix}/api/paper/<paper_id>/references',
                    'build_graph': f'{url_prefix}/api/graph/<paper_id>?iterations=3&cited_limit=5&ref_limit=5',
                    'build_multiple_graph': f'{url_prefix}/api/graph/multiple (POST)',
                    'graph_neighbors': f'{url_prefix}/api/graph/<paper_id>/neighbors',
                    'graph_stats': f'{url_prefix}/api/graph/stats',
                    'graph_data': f'{url_prefix}/api/graph/data',
                    'clear_graph': f'{url_prefix}/api/graph/clear (POST)',
                    'health': f'{url_prefix}/health'
                }
            })
    
    return app


# Read environment config
config_name = os.getenv('FLASK_ENV', 'development')
app = create_app(config_name=config_name, url_prefix='/flask')

if __name__ == '__main__':
    app.run(
        debug=app.config['DEBUG'],
        host=app.config['HOST'],
        port=app.config['PORT']
    )