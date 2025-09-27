"""Graph API routes for RefNet."""

from flask import Blueprint, request, jsonify
from datetime import datetime

from ..services.graph_service import GraphService
from ..utils.validators import validate_graph_params, validate_paper_id

graph_bp = Blueprint('graph', __name__)

# Initialize service
graph_service = GraphService()


@graph_bp.route('/graph/<path:paper_id>', methods=['GET'])
def build_paper_graph(paper_id):
    """
    Build a citation graph starting from a specific paper.
    
    Query parameters:
    - iterations: Number of expansion iterations (default: 3)
    - cited_limit: Number of top cited papers per iteration (default: 5)
    - ref_limit: Number of top reference papers per iteration (default: 5)
    """
    try:
        # Validate paper ID
        is_valid, normalized_id = validate_paper_id(paper_id)
        if not is_valid:
            return jsonify({'error': 'Invalid paper ID'}), 400
        
        # Validate graph parameters
        is_valid, error_msg, params = validate_graph_params(request.args)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Build the graph
        graph_data = graph_service.build_graph_from_root(
            root_paper_id=normalized_id,
            iterations=params['iterations'],
            top_cited_limit=params['cited_limit'],
            top_references_limit=params['ref_limit']
        )
        
        if 'error' in graph_data:
            return jsonify(graph_data), 404
        
        # Add request metadata
        graph_data['request'] = {
            'root_paper_id': normalized_id,
            'iterations': params['iterations'],
            'cited_limit': params['cited_limit'],
            'ref_limit': params['ref_limit'],
            'generated_at': datetime.now().isoformat()
        }
        
        return jsonify(graph_data)
    
    except Exception as e:
        return jsonify({'error': 'Failed to build graph', 'details': str(e)}), 500


@graph_bp.route('/graph/multiple', methods=['POST'])
def build_multiple_root_graph():
    """
    Build a citation graph starting from multiple root papers.
    
    Request body should contain:
    - root_paper_ids: List of paper IDs
    - iterations: Number of expansion iterations (default: 3)
    - cited_limit: Number of top cited papers per iteration (default: 5)
    - ref_limit: Number of top reference papers per iteration (default: 5)
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required'}), 400
        
        root_paper_ids = data.get('root_paper_ids', [])
        if not root_paper_ids or not isinstance(root_paper_ids, list):
            return jsonify({'error': 'root_paper_ids must be a non-empty list'}), 400
        
        # Validate all paper IDs
        for paper_id in root_paper_ids:
            is_valid, _ = validate_paper_id(paper_id)
            if not is_valid:
                return jsonify({'error': f'Invalid paper ID: {paper_id}'}), 400
        
        # Validate graph parameters
        is_valid, error_msg, params = validate_graph_params(data)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Build the graph
        graph_data = graph_service.build_graph_from_multiple_roots(
            root_paper_ids=root_paper_ids,
            iterations=params['iterations'],
            top_cited_limit=params['cited_limit'],
            top_references_limit=params['ref_limit']
        )
        
        if 'error' in graph_data:
            return jsonify(graph_data), 404
        
        # Add request metadata
        graph_data['request'] = {
            'root_paper_ids': root_paper_ids,
            'iterations': params['iterations'],
            'cited_limit': params['cited_limit'],
            'ref_limit': params['ref_limit'],
            'generated_at': datetime.now().isoformat()
        }
        
        return jsonify(graph_data)
    
    except Exception as e:
        return jsonify({'error': 'Failed to build graph', 'details': str(e)}), 500


@graph_bp.route('/graph/<path:paper_id>/neighbors', methods=['GET'])
def get_paper_neighbors(paper_id):
    """Get immediate neighbors (citations and references) of a paper in the current graph."""
    try:
        neighbors = graph_service.get_paper_neighbors(paper_id)
        
        if 'error' in neighbors:
            return jsonify(neighbors), 404
        
        return jsonify({
            'paper_id': paper_id,
            'neighbors': neighbors,
            'retrieved_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': 'Failed to get neighbors', 'details': str(e)}), 500


@graph_bp.route('/graph/stats', methods=['GET'])
def get_graph_stats():
    """Get statistics about the current graph."""
    try:
        stats = graph_service.get_graph_statistics()
        
        if 'error' in stats:
            return jsonify(stats), 404
        
        return jsonify({
            'stats': stats,
            'retrieved_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': 'Failed to get graph stats', 'details': str(e)}), 500


@graph_bp.route('/graph/clear', methods=['POST'])
def clear_graph():
    """Clear the current graph."""
    try:
        graph_service.clear_graph()
        
        return jsonify({
            'message': 'Graph cleared successfully',
            'cleared_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': 'Failed to clear graph', 'details': str(e)}), 500


@graph_bp.route('/graph/data', methods=['GET'])
def get_graph_data():
    """Get the current graph data."""
    try:
        graph_data = graph_service.get_graph_data()
        
        return jsonify({
            'graph': graph_data,
            'retrieved_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': 'Failed to get graph data', 'details': str(e)}), 500
