"""Validation utilities for RefNet."""

from typing import Dict, Any, Tuple, Optional


def validate_paper_id(paper_id: str) -> Tuple[bool, str]:
    """
    Validate and normalize a paper ID.
    
    Args:
        paper_id: The paper ID to validate
        
    Returns:
        Tuple of (is_valid, normalized_id)
    """
    if not paper_id or not isinstance(paper_id, str):
        return False, ""
    
    paper_id = paper_id.strip()
    if not paper_id:
        return False, ""
    
    # Normalize the ID
    if paper_id.startswith('10.'):
        normalized_id = f"https://doi.org/{paper_id}"
    elif not paper_id.startswith('https://openalex.org/'):
        normalized_id = f"https://openalex.org/{paper_id}"
    else:
        normalized_id = paper_id
    
    return True, normalized_id


def validate_search_params(params: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Validate search parameters.
    
    Args:
        params: Dictionary of search parameters
        
    Returns:
        Tuple of (is_valid, error_message, cleaned_params)
    """
    cleaned_params = {}
    
    # Validate query
    query = params.get('q', '').strip()
    if not query:
        return False, "Query parameter 'q' is required", {}
    cleaned_params['query'] = query
    
    # Validate page
    try:
        page = int(params.get('page', 1))
        if page < 1:
            return False, "Page must be a positive integer", {}
        cleaned_params['page'] = page
    except (ValueError, TypeError):
        return False, "Page must be a valid integer", {}
    
    # Validate per_page
    try:
        per_page = int(params.get('per_page', 25))
        if per_page < 1 or per_page > 50:
            return False, "Per page must be between 1 and 50", {}
        cleaned_params['per_page'] = per_page
    except (ValueError, TypeError):
        return False, "Per page must be a valid integer", {}
    
    # Validate sort_by
    valid_sorts = ['cited_by_count', 'relevance_score', 'publication_date']
    sort_by = params.get('sort', 'cited_by_count')
    if sort_by not in valid_sorts:
        return False, f"Sort must be one of: {', '.join(valid_sorts)}", {}
    cleaned_params['sort_by'] = sort_by
    
    return True, "", cleaned_params


def validate_graph_params(params: Dict[str, Any]) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Validate graph building parameters.
    
    Args:
        params: Dictionary of graph parameters
        
    Returns:
        Tuple of (is_valid, error_message, cleaned_params)
    """
    cleaned_params = {}
    
    # Validate iterations
    try:
        iterations = int(params.get('iterations', 3))
        if iterations < 1 or iterations > 5:
            return False, "Iterations must be between 1 and 5", {}
        cleaned_params['iterations'] = iterations
    except (ValueError, TypeError):
        return False, "Iterations must be a valid integer", {}
    
    # Validate cited_limit
    try:
        cited_limit = int(params.get('cited_limit', 5))
        if cited_limit < 1 or cited_limit > 20:
            return False, "Cited limit must be between 1 and 20", {}
        cleaned_params['cited_limit'] = cited_limit
    except (ValueError, TypeError):
        return False, "Cited limit must be a valid integer", {}
    
    # Validate ref_limit
    try:
        ref_limit = int(params.get('ref_limit', 5))
        if ref_limit < 1 or ref_limit > 20:
            return False, "Reference limit must be between 1 and 20", {}
        cleaned_params['ref_limit'] = ref_limit
    except (ValueError, TypeError):
        return False, "Reference limit must be a valid integer", {}
    
    return True, "", cleaned_params

