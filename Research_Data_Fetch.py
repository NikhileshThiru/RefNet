from flask import Flask, request, jsonify, render_template
from datetime import datetime
from dotenv import load_dotenv
from pyalex import Works, config
from Paper_Graph import PaperGraph
import os

app = Flask(__name__)

# Searches for papers on OpenAlex based on a query and sorting choice
def search_papers(query, page=1, per_page=25, sort_by='cited_by_count'):
    try:
        works_query = Works().search(query)
        
        if sort_by == 'cited_by_count':
            works_query = works_query.sort(cited_by_count='desc')
        elif sort_by == 'relevance_score':
            works_query = works_query.sort(relevance_score='desc')
        elif sort_by == 'publication_date':
            works_query = works_query.sort(publication_date='desc')
        
        response = works_query.get(per_page=per_page, page=page)
        
        if hasattr(response, 'results'):
            results = response.results
            meta = response.meta
        else:
            results = response
            meta = {'count': len(results) if results else 0}
        
        return {
            'results': results,
            'meta': meta
        }
    
    except:
        return None

# Gets one paper’s details using its ID or DOI
def get_paper_by_id(paper_id):
    try:
        if paper_id.startswith('10.'):
            paper_id = f"https://doi.org/{paper_id}"
        elif not paper_id.startswith('https://openalex.org/'):
            paper_id = f"https://openalex.org/{paper_id}"
        
        paper = Works()[paper_id]
        return paper
    
    except:
        return None

#  Cleans up raw paper data into a nice dictionary with main info
def format_paper_data(paper):
    pub_year = paper.get('publication_year')
    
    authors = []
    if paper.get('authorships'):
        for authorship in paper['authorships']:
            author = authorship.get('author', {})
            author_name = author.get('display_name', 'Unknown Author')
            authors.append(author_name)
    
    abstract_text = ""
    if paper.get('abstract'):
        abstract_text = paper['abstract'][:500] + "..." if len(paper['abstract']) > 500 else paper['abstract']
    
    topics = []
    if paper.get('concepts'):
        for concept in paper['concepts'][:5]:
            topics.append(concept.get('display_name', ''))
    
    doi = None
    if paper.get('doi'):
        doi = paper['doi'].replace('https://doi.org/', '')
    
    citations = paper.get('cited_by_count', 0)
    
    venue = None
    if paper.get('primary_location', {}).get('source', {}):
        venue = paper.get('primary_location', {}).get('source', {}).get('display_name', 'Unknown Venue')
    
    pub_type = paper.get('type', 'Unknown')
    language = paper.get('language', 'Unknown')
    
    is_open_access = paper.get('open_access', {}).get('is_oa', False)
    oa_url = paper.get('open_access', {}).get('oa_url', None)
    
    return {
        'id': paper.get('id', ''),
        'title': paper.get('title', 'Untitled'),
        'authors': authors,
        'year': pub_year,
        'abstract': abstract_text,
        'doi': doi,
        'citations': citations,
        'venue': venue,
        'topics': topics,
        'type': pub_type,
        'language': language,
        'is_open_access': is_open_access,
        'openalex_url': paper.get('id', ''),
        'pdf_url': oa_url,
        'publication_date': paper.get('publication_date'),
        'referenced_works_count': len(paper.get('referenced_works', [])),
        'related_works_count': len(paper.get('related_works', []))
    }

# API route to search for research papers with filters
@app.route('/search', methods=['GET'])
def search_research_papers():
    try:
        query = request.args.get('q', '').strip()
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 25)), 50)
        sort_by = request.args.get('sort', 'cited_by_count')
        
        if not query:
            return jsonify({'error': 'Query required'}), 400
        
        valid_sorts = ['cited_by_count', 'relevance_score', 'publication_date']
        if sort_by not in valid_sorts:
            return jsonify({'error': 'Invalid sort'}), 400
        
        search_results = search_papers(query, page, per_page, sort_by)
        
        if search_results is None:
            return jsonify({'error': 'Search failed'}), 500
        
        papers = []
        if search_results.get('results'):
            for paper in search_results['results']:
                formatted_paper = format_paper_data(paper)
                papers.append(formatted_paper)
        
        meta = search_results.get('meta', {})
        total_count = meta.get('count', 0)
        
        response = {
            'query': query,
            'total_results': total_count,
            'page': page,
            'per_page': per_page,
            'total_pages': (total_count + per_page - 1) // per_page if total_count > 0 else 0,
            'papers': papers,
            'search_time': datetime.now().isoformat(),
            'sort_by': sort_by,
            'api_response_time_ms': meta.get('db_response_time_ms')
        }
        
        return jsonify(response)
    
    except:
        return jsonify({'error': 'Something went wrong'}), 500

# API route to get detailed info about one paper
@app.route('/paper/<path:paper_id>', methods=['GET'])
def get_paper_details(paper_id):
    try:
        paper_data = get_paper_by_id(paper_id)
        
        if paper_data is None:
            return jsonify({'error': 'Paper not found'}), 404
        
        formatted_paper = format_paper_data(paper_data)
        
        return jsonify({
            'paper': formatted_paper,
            'retrieved_at': datetime.now().isoformat()
        })
    
    except:
        return jsonify({'error': 'Something went wrong'}), 500

# API route to list all papers that cited a given paper
@app.route('/paper/<path:paper_id>/citations', methods=['GET'])
def get_paper_citations(paper_id):
    try:
        if paper_id.startswith('10.'):
            paper_id = f"https://doi.org/{paper_id}"
        elif not paper_id.startswith('https://openalex.org/'):
            paper_id = f"https://openalex.org/{paper_id}"
        
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 25)), 50)
        
        citing_papers = Works().filter(cites=paper_id).sort(cited_by_count='desc')
        results = citing_papers.get(per_page=per_page, page=page)
        meta = citing_papers.meta
        
        papers = []
        if results:
            for paper in results:
                formatted_paper = format_paper_data(paper)
                papers.append(formatted_paper)
        
        total_count = meta.get('count', 0)
        
        return jsonify({
            'cited_paper_id': paper_id,
            'total_citations': total_count,
            'page': page,
            'per_page': per_page,
            'total_pages': (total_count + per_page - 1) // per_page if total_count > 0 else 0,
            'citing_papers': papers,
            'retrieved_at': datetime.now().isoformat()
        })
    
    except:
        return jsonify({'error': 'Something went wrong'}), 500

# API route to list all references a paper used
@app.route('/paper/<path:paper_id>/references', methods=['GET'])
def get_paper_references(paper_id):
    try:
        paper_data = get_paper_by_id(paper_id)
        
        if paper_data is None:
            return jsonify({'error': 'Paper not found'}), 404
        
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 25)), 50)
        
        referenced_works = paper_data.get('referenced_works', [])
        total_refs = len(referenced_works)
        
        if total_refs == 0:
            return jsonify({
                'paper_id': paper_data.get('id'),
                'total_references': 0,
                'references': [],
                'retrieved_at': datetime.now().isoformat()
            })
        
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_refs = referenced_works[start_idx:end_idx]
        
        references = []
        for ref_id in paginated_refs:
            ref_paper = get_paper_by_id(ref_id)
            if ref_paper:
                formatted_ref = format_paper_data(ref_paper)
                references.append(formatted_ref)
        
        return jsonify({
            'paper_id': paper_data.get('id'),
            'total_references': total_refs,
            'page': page,
            'per_page': per_page,
            'total_pages': (total_refs + per_page - 1) // per_page,
            'references': references,
            'retrieved_at': datetime.now().isoformat()
        })
    
    except:
        return jsonify({'error': 'Something went wrong'}), 500

# Simple route to check if the API is working fine
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'RefNet Research Paper Search API',
        'pyalex_version': '0.18'
    })

# Initialize graph builder
graph_builder = PaperGraph()

# API route to build a citation graph for a paper
@app.route('/graph/<path:paper_id>', methods=['GET'])
def build_paper_graph(paper_id):
    """
    Build a citation graph starting from a specific paper.
    
    Query parameters:
    - iterations: Number of expansion iterations (default: 3)
    - cited_limit: Number of top cited papers per iteration (default: 5)
    - ref_limit: Number of top reference papers per iteration (default: 5)
    """
    try:
        iterations = int(request.args.get('iterations', 3))
        cited_limit = int(request.args.get('cited_limit', 5))
        ref_limit = int(request.args.get('ref_limit', 5))
        
        # Validate parameters
        if iterations < 1 or iterations > 5:
            return jsonify({'error': 'Iterations must be between 1 and 5'}), 400
        if cited_limit < 1 or cited_limit > 20:
            return jsonify({'error': 'Cited limit must be between 1 and 20'}), 400
        if ref_limit < 1 or ref_limit > 20:
            return jsonify({'error': 'Reference limit must be between 1 and 20'}), 400
        
        # Build the graph
        graph_data = graph_builder.build_graph(
            root_paper_id=paper_id,
            iterations=iterations,
            top_cited_limit=cited_limit,
            top_references_limit=ref_limit
        )
        
        if 'error' in graph_data:
            return jsonify(graph_data), 404
        
        # Add request metadata
        graph_data['request'] = {
            'root_paper_id': paper_id,
            'iterations': iterations,
            'cited_limit': cited_limit,
            'ref_limit': ref_limit,
            'generated_at': datetime.now().isoformat()
        }
        
        return jsonify(graph_data)
    
    except ValueError as e:
        return jsonify({'error': 'Invalid parameter values'}), 400
    except Exception as e:
        return jsonify({'error': 'Failed to build graph', 'details': str(e)}), 500

# API route to get neighbors of a specific paper in the graph
@app.route('/graph/<path:paper_id>/neighbors', methods=['GET'])
def get_paper_neighbors(paper_id):
    """Get immediate neighbors (citations and references) of a paper in the current graph"""
    try:
        neighbors = graph_builder.get_paper_neighbors(paper_id)
        
        if 'error' in neighbors:
            return jsonify(neighbors), 404
        
        return jsonify({
            'paper_id': paper_id,
            'neighbors': neighbors,
            'retrieved_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': 'Failed to get neighbors', 'details': str(e)}), 500

# API route to get graph statistics
@app.route('/graph/stats', methods=['GET'])
def get_graph_stats():
    """Get statistics about the current graph"""
    try:
        if not graph_builder.graph.nodes():
            return jsonify({'error': 'No graph built yet'}), 404
        
        import networkx as nx
        
        stats = {
            'total_papers': len(graph_builder.graph.nodes()),
            'total_citations': len(graph_builder.graph.edges()),
            'density': nx.density(graph_builder.graph),
            'is_connected': nx.is_weakly_connected(graph_builder.graph),
            'average_degree': sum(dict(graph_builder.graph.degree()).values()) / len(graph_builder.graph.nodes()) if graph_builder.graph.nodes() else 0,
            'max_degree': max(dict(graph_builder.graph.degree()).values()) if graph_builder.graph.nodes() else 0,
            'components': nx.number_weakly_connected_components(graph_builder.graph)
        }
        
        # Get top papers by citation count
        papers_with_citations = []
        for node_id, data in graph_builder.graph.nodes(data=True):
            papers_with_citations.append({
                'id': node_id,
                'title': data.get('title', 'Untitled'),
                'citations': data.get('citations', 0),
                'year': data.get('year')
            })
        
        papers_with_citations.sort(key=lambda x: x['citations'], reverse=True)
        stats['top_papers'] = papers_with_citations[:10]
        
        return jsonify({
            'stats': stats,
            'retrieved_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': 'Failed to get graph stats', 'details': str(e)}), 500

# API route to clear the current graph
@app.route('/graph/clear', methods=['POST'])
def clear_graph():
    """Clear the current graph"""
    try:
        graph_builder.graph.clear()
        graph_builder.added_papers.clear()
        graph_builder.paper_data_cache.clear()
        
        return jsonify({
            'message': 'Graph cleared successfully',
            'cleared_at': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': 'Failed to clear graph', 'details': str(e)}), 500

@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'message': 'RefNet Search API',
        'search_endpoint': '/search?q=your_query&page=1&per_page=25&sort=cited_by_count',
        'graph_endpoints': {
            'build_graph': '/graph/<paper_id>?iterations=3&cited_limit=5&ref_limit=5',
            'get_neighbors': '/graph/<paper_id>/neighbors',
            'get_stats': '/graph/stats',
            'clear_graph': '/graph/clear (POST)'
        }
    })

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 8000))
    app.run(debug=True, host='0.0.0.0', port=port)
