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
        result = graph_service.clear_graph()
        return jsonify(result)
    
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


@graph_bp.route('/graph/add-source', methods=['POST'])
def add_source_node():
    """
    Add a new source node to the existing graph.
    
    JSON body:
    - paper_id: Paper ID to add as source
    - expand_from_node: Whether to expand from this new node (default: false)
    - iterations: Number of expansion iterations (default: 2)
    - cited_limit: Number of top cited papers per iteration (default: 3)
    - ref_limit: Number of top reference papers per iteration (default: 3)
    """
    try:
        data = request.get_json()
        if not data or 'paper_id' not in data:
            return jsonify({'error': 'paper_id is required'}), 400
        
        paper_id = data['paper_id']
        expand_from_node = data.get('expand_from_node', False)
        iterations = data.get('iterations', 2)
        cited_limit = data.get('cited_limit', 3)
        ref_limit = data.get('ref_limit', 3)
        
        # Validate parameters
        if iterations < 1 or iterations > 5:
            return jsonify({'error': 'Iterations must be between 1 and 5'}), 400
        if cited_limit < 1 or cited_limit > 20:
            return jsonify({'error': 'Cited limit must be between 1 and 20'}), 400
        if ref_limit < 1 or ref_limit > 20:
            return jsonify({'error': 'Reference limit must be between 1 and 20'}), 400
        
        result = graph_service.add_source_node(
            paper_id=paper_id,
            expand_from_node=expand_from_node,
            iterations=iterations,
            top_cited_limit=cited_limit,
            top_references_limit=ref_limit
        )
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': 'Failed to add source node', 'details': str(e)}), 500


@graph_bp.route('/graph/<path:paper_id>/expand', methods=['POST'])
def expand_from_node(paper_id):
    """
    Expand the graph from a specific existing node.
    
    JSON body:
    - iterations: Number of expansion iterations (default: 2)
    - cited_limit: Number of top cited papers per iteration (default: 3)
    - ref_limit: Number of top reference papers per iteration (default: 3)
    """
    try:
        data = request.get_json() or {}
        iterations = data.get('iterations', 2)
        cited_limit = data.get('cited_limit', 3)
        ref_limit = data.get('ref_limit', 3)
        
        # Validate parameters
        if iterations < 1 or iterations > 5:
            return jsonify({'error': 'Iterations must be between 1 and 5'}), 400
        if cited_limit < 1 or cited_limit > 20:
            return jsonify({'error': 'Cited limit must be between 1 and 20'}), 400
        if ref_limit < 1 or ref_limit > 20:
            return jsonify({'error': 'Reference limit must be between 1 and 20'}), 400
        
        result = graph_service.expand_from_node(
            paper_id=paper_id,
            iterations=iterations,
            top_cited_limit=cited_limit,
            top_references_limit=ref_limit
        )
        
        if 'error' in result:
            return jsonify(result), 404
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': 'Failed to expand from node', 'details': str(e)}), 500


@graph_bp.route('/graph/<path:paper_id>/remove', methods=['DELETE'])
def remove_node(paper_id):
    """
    Remove a node and optionally its orphaned connections.
    
    JSON body:
    - remove_orphaned: Whether to remove nodes that become orphaned (default: false)
    """
    try:
        data = request.get_json() or {}
        remove_orphaned = data.get('remove_orphaned', False)
        
        result = graph_service.remove_node_with_connections(
            paper_id=paper_id,
            remove_orphaned=remove_orphaned
        )
        
        if 'error' in result:
            return jsonify(result), 404
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': 'Failed to remove node', 'details': str(e)}), 500


@graph_bp.route('/graph/<path:paper_id>/info', methods=['GET'])
def get_node_info(paper_id):
    """Get detailed information about a specific node in the graph."""
    try:
        result = graph_service.get_node_info(paper_id)
        
        if 'error' in result:
            return jsonify(result), 404
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': 'Failed to get node info', 'details': str(e)}), 500
