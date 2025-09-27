"""Search API routes for RefNet."""

from flask import Blueprint, request, jsonify
from datetime import datetime

from ..services.openalex_service import OpenAlexService
from ..utils.validators import validate_search_params

search_bp = Blueprint('search', __name__)

# Initialize service
openalex_service = OpenAlexService()


@search_bp.route('/search', methods=['GET'])
def search_research_papers():
    """Search for research papers with filters."""
    try:
        # Validate parameters
        is_valid, error_msg, params = validate_search_params(request.args)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Search papers
        search_results = openalex_service.search_papers(
            query=params['query'],
            page=params['page'],
            per_page=params['per_page'],
            sort_by=params['sort_by']
        )
        
        if search_results is None:
            return jsonify({'error': 'Search failed'}), 500
        
        # Format papers
        papers = []
        if search_results.get('results'):
            for raw_paper in search_results['results']:
                paper = openalex_service.get_paper_by_id(raw_paper.get('id', ''))
                if paper:
                    papers.append(paper.to_dict())
        
        # Prepare response
        meta = search_results.get('meta', {})
        total_count = meta.get('count', 0)
        
        response = {
            'query': params['query'],
            'total_results': total_count,
            'page': params['page'],
            'per_page': params['per_page'],
            'total_pages': (total_count + params['per_page'] - 1) // params['per_page'] if total_count > 0 else 0,
            'papers': papers,
            'search_time': datetime.now().isoformat(),
            'sort_by': params['sort_by'],
            'api_response_time_ms': meta.get('db_response_time_ms')
        }
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({'error': 'Something went wrong', 'details': str(e)}), 500
