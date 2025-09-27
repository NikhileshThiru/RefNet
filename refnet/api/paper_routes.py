"""Paper API routes for RefNet."""

from flask import Blueprint, request, jsonify
from datetime import datetime

from ..services.openalex_service import OpenAlexService
from ..utils.validators import validate_paper_id

paper_bp = Blueprint('paper', __name__)

# Initialize service
openalex_service = OpenAlexService()


@paper_bp.route('/paper/<path:paper_id>', methods=['GET'])
def get_paper_details(paper_id):
    """Get detailed information about a specific paper."""
    try:
        paper = openalex_service.get_paper_by_id(paper_id)
        
        if paper is None:
            return jsonify({'error': 'Paper not found'}), 404
        
        return jsonify({
            'paper': paper.to_dict(),
            'retrieved_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': 'Something went wrong', 'details': str(e)}), 500


@paper_bp.route('/paper/<path:paper_id>/citations', methods=['GET'])
def get_paper_citations(paper_id):
    """Get all papers that cite the given paper."""
    try:
        # Validate paper ID
        is_valid, normalized_id = validate_paper_id(paper_id)
        if not is_valid:
            return jsonify({'error': 'Invalid paper ID'}), 400
        
        # Get pagination parameters
        try:
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 25)), 50)
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid pagination parameters'}), 400
        
        # Get citing papers
        citing_data = openalex_service.get_citing_papers(normalized_id, page, per_page)
        
        if citing_data is None:
            return jsonify({'error': 'Failed to fetch citations'}), 500
        
        # Format papers
        papers = []
        if citing_data.get('results'):
            for raw_paper in citing_data['results']:
                paper = openalex_service.get_paper_by_id(raw_paper.get('id', ''))
                if paper:
                    papers.append(paper.to_dict())
        
        # Prepare response
        meta = citing_data.get('meta', {})
        total_count = meta.get('count', 0)
        
        return jsonify({
            'cited_paper_id': normalized_id,
            'total_citations': total_count,
            'page': page,
            'per_page': per_page,
            'total_pages': (total_count + per_page - 1) // per_page if total_count > 0 else 0,
            'citing_papers': papers,
            'retrieved_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': 'Something went wrong', 'details': str(e)}), 500


@paper_bp.route('/paper/<path:paper_id>/references', methods=['GET'])
def get_paper_references(paper_id):
    """Get all references used by the given paper."""
    try:
        # Validate paper ID
        is_valid, normalized_id = validate_paper_id(paper_id)
        if not is_valid:
            return jsonify({'error': 'Invalid paper ID'}), 400
        
        # Get pagination parameters
        try:
            page = int(request.args.get('page', 1))
            per_page = min(int(request.args.get('per_page', 25)), 50)
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid pagination parameters'}), 400
        
        # Get reference IDs
        reference_ids = openalex_service.get_paper_references(normalized_id)
        
        if reference_ids is None:
            return jsonify({'error': 'Paper not found'}), 404
        
        total_refs = len(reference_ids)
        
        if total_refs == 0:
            return jsonify({
                'paper_id': normalized_id,
                'total_references': 0,
                'references': [],
                'retrieved_at': datetime.now().isoformat()
            })
        
        # Paginate references
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_refs = reference_ids[start_idx:end_idx]
        
        # Get paper details for references
        references = []
        for ref_id in paginated_refs:
            paper = openalex_service.get_paper_by_id(ref_id)
            if paper:
                references.append(paper.to_dict())
        
        return jsonify({
            'paper_id': normalized_id,
            'total_references': total_refs,
            'page': page,
            'per_page': per_page,
            'total_pages': (total_refs + per_page - 1) // per_page,
            'references': references,
            'retrieved_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': 'Something went wrong', 'details': str(e)}), 500
