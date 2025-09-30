"""Service for building and managing citation graphs."""

from typing import Dict, List, Set, Optional, Any
import networkx as nx
from datetime import datetime

from ..models.paper import Paper
from ..models.graph import GraphData, GraphNode, GraphEdge, GraphMetadata
from ..services.openalex_service import OpenAlexService
from ..utils.validators import validate_paper_id


class GraphService:
    """Service for building and managing citation graphs."""
    
    def __init__(self, openalex_service: Optional[OpenAlexService] = None):
        """
        Initialize graph service.
        
        Args:
            openalex_service: OpenAlex service instance
        """
        self.graph = nx.DiGraph()
        self.added_papers: Set[str] = set()
        self.openalex_service = openalex_service or OpenAlexService()
        self.paper_cache: Dict[str, Paper] = {}  # Cache for papers
    
    def add_paper_to_graph(self, paper_id: str, is_root: bool = False, paper_data: Optional[Paper] = None) -> bool:
        """
        Add a paper to the graph.
        
        Args:
            paper_id: Paper ID to add
            is_root: Whether this is a root paper
            paper_data: Pre-fetched paper data (optional)
            
        Returns:
            True if successfully added, False otherwise
        """
        is_valid, normalized_id = validate_paper_id(paper_id)
        if not is_valid or normalized_id in self.added_papers:
            return False
        
        # Use provided paper data, check cache, or fetch it
        if paper_data:
            paper = paper_data
        elif normalized_id in self.paper_cache:
            paper = self.paper_cache[normalized_id]
        else:
            # Use the original paper_id for the API call, not the normalized one
            paper = self.openalex_service.get_paper_by_id(paper_id)
            if not paper:
                return False
            # Cache the paper for future use using both IDs
            self.paper_cache[normalized_id] = paper
            self.paper_cache[paper.id] = paper
        
        # Apply strict author filtering for non-root papers - match frontend logic
        if not is_root:
            # Use same logic as frontend: d.authors && d.authors.length > 0
            if not paper.authors or not isinstance(paper.authors, list) or len(paper.authors) == 0:
                return False
        
        # Note: We don't skip papers with 0 citations as they might be legitimate papers
        
        # Add node to graph
        self.graph.add_node(normalized_id, **paper.to_dict())
        self.added_papers.add(normalized_id)
        if paper.id != normalized_id:
            self.added_papers.add(paper.id)
        return True
    
    def is_paper_in_graph(self, paper_id: str) -> bool:
        """
        Check if a paper is already in the graph.
        
        Args:
            paper_id: Paper ID to check
            
        Returns:
            True if paper is in graph, False otherwise
        """
        is_valid, normalized_id = validate_paper_id(paper_id)
        if not is_valid:
            return False
        return normalized_id in self.added_papers or paper_id in self.added_papers
    
    def get_paper_from_graph(self, paper_id: str) -> Optional[Dict]:
        """
        Get paper data from graph if it exists.
        
        Args:
            paper_id: Paper ID to get
            
        Returns:
            Paper data if exists, None otherwise
        """
        is_valid, normalized_id = validate_paper_id(paper_id)
        if not is_valid or normalized_id not in self.graph:
            return None
        return self.graph.nodes[normalized_id]
    
    def remove_paper_from_graph(self, paper_id: str) -> bool:
        """
        Remove a paper from the graph.
        
        Args:
            paper_id: Paper ID to remove
            
        Returns:
            True if successfully removed, False otherwise
        """
        is_valid, normalized_id = validate_paper_id(paper_id)
        if not is_valid or normalized_id not in self.graph:
            return False
        
        # Remove all edges connected to this node
        edges_to_remove = list(self.graph.edges(normalized_id))
        for edge in edges_to_remove:
            self.graph.remove_edge(*edge)
        
        # Remove the node
        self.graph.remove_node(normalized_id)
        self.added_papers.discard(normalized_id)
        return True
    
    def build_graph_from_roots(self, root_paper_ids: List[str], iterations: int = 3,
                              top_cited_limit: int = 5, top_references_limit: int = 5) -> Dict[str, Any]:
        """
        Build a citation graph starting from multiple root papers using batch operations.
        
        Args:
            root_paper_ids: List of root paper IDs
            iterations: Number of expansion iterations
            top_cited_limit: Number of top cited papers per iteration
            top_references_limit: Number of top reference papers per iteration
            
        Returns:
            Graph data or error information
        """
        # Reset graph state for each new request
        self.graph.clear()
        self.added_papers.clear()
        self.paper_cache.clear()
        
        print(f"🔍 Building graph from {len(root_paper_ids)} root papers: {root_paper_ids}")
        
        # Add all root papers first
        valid_root_ids = []
        for root_id in root_paper_ids:
            if self.add_paper_to_graph(root_id, is_root=True):
                is_valid, normalized_id = validate_paper_id(root_id)
                if is_valid:
                    valid_root_ids.append(normalized_id)
                else:
                    print(f"❌ Invalid root paper ID: {root_id}")
            else:
                print(f"❌ Failed to add root paper: {root_id}")
        
        if not valid_root_ids:
            return {'error': 'Could not fetch any root papers'}
        
        current_level = valid_root_ids.copy()
        
        for iteration in range(iterations):
            print(f"🔄 Iteration {iteration + 1}: Processing {len(current_level)} papers")
            
            # Collect all paper IDs to process in this iteration
            papers_to_process = current_level.copy()
            
            # Calculate multiples for efficient API calls - use 3x multiplier
            cited_multiple = min(200, top_cited_limit * 5)  # 3x multiplier, max 200
            ref_multiple = min(200, top_references_limit * 5)  # 3x multiplier, max 200
            
            # Batch get citations and references for all papers (combined call)
            combined_data = self.openalex_service.get_citations_and_references_batch(
                papers_to_process, 
                cited_per_page=cited_multiple,
                ref_per_page=ref_multiple
            )
            citations_map = {paper_id: data['citations'] for paper_id, data in combined_data.items()}
            references_map = {paper_id: data['references'] for paper_id, data in combined_data.items()}
            
            # Collect all new paper IDs we'll need
            all_new_paper_ids = set()
            for paper_id in current_level:
                citing_paper_ids = citations_map.get(paper_id, [])[:top_cited_limit]
                reference_paper_ids = references_map.get(paper_id, [])[:top_references_limit]
                all_new_paper_ids.update(citing_paper_ids)
                all_new_paper_ids.update(reference_paper_ids)
            
            # Batch fetch all new papers
            if all_new_paper_ids:
                print(f"📚 Fetching {len(all_new_paper_ids)} new papers...")
                papers_data = self.openalex_service.get_papers_batch(list(all_new_paper_ids))
                
                # Add papers to cache
                for paper_data in papers_data:
                    if paper_data and paper_data.id:
                        self.paper_cache[paper_data.id] = paper_data
            
            # Process each paper in current level
            next_level = []
            for paper_id in current_level:
                citing_paper_ids = citations_map.get(paper_id, [])[:top_cited_limit]
                reference_paper_ids = references_map.get(paper_id, [])[:top_references_limit]
                
                # Process citations
                for citing_id in citing_paper_ids:
                    if self.add_paper_to_graph(citing_id):
                        is_valid, normalized_citing_id = validate_paper_id(citing_id)
                        if is_valid:
                            self.graph.add_edge(normalized_citing_id, paper_id)
                            next_level.append(normalized_citing_id)
                
                # Process references
                for ref_id in reference_paper_ids:
                    if self.add_paper_to_graph(ref_id):
                        is_valid, normalized_ref_id = validate_paper_id(ref_id)
                        if is_valid:
                            self.graph.add_edge(paper_id, normalized_ref_id)
                            next_level.append(normalized_ref_id)
            
            current_level = next_level
            print(f"✅ Iteration {iteration + 1} complete. Next level: {len(current_level)} papers")
        
        return self.get_graph_data()

    def build_graph_from_root(self, root_paper_id: str, iterations: int = 3,
                            top_cited_limit: int = 5, top_references_limit: int = 5) -> Dict[str, Any]:
        """
        Build a citation graph starting from a root paper using batch operations.
        
        Args:
            root_paper_id: ID of the root paper
            iterations: Number of expansion iterations
            top_cited_limit: Number of top cited papers per iteration
            top_references_limit: Number of top reference papers per iteration
            
        Returns:
            Graph data or error information
        """
        # Reset graph state for each new request
        self.graph.clear()
        self.added_papers.clear()
        self.paper_cache.clear()
        
        if not self.add_paper_to_graph(root_paper_id, is_root=True):
            return {'error': 'Could not fetch root paper'}
        
        is_valid, normalized_id = validate_paper_id(root_paper_id)
        if not is_valid:
            return {'error': 'Invalid paper ID'}
        
        current_level = [normalized_id]
        
        for iteration in range(iterations):
            # Calculate multiples for efficient API calls - use 3x multiplier
            cited_multiple = min(200, top_cited_limit * 3)  # 3x multiplier, max 200
            ref_multiple = min(200, top_references_limit * 3)  # 3x multiplier, max 200
            
            # Batch get citations and references for all papers in current level (combined call)
            combined_data = self.openalex_service.get_citations_and_references_batch(
                current_level,
                cited_per_page=cited_multiple,
                ref_per_page=ref_multiple
            )
            citations_map = {paper_id: data['citations'] for paper_id, data in combined_data.items()}
            references_map = {paper_id: data['references'] for paper_id, data in combined_data.items()}
            
            # Collect all new paper IDs we'll need for the next layer (pre-filter duplicates)
            all_new_paper_ids = set()
            for paper_id in current_level:
                all_new_paper_ids.update(citations_map.get(paper_id, [])[:top_cited_limit])
                all_new_paper_ids.update(references_map.get(paper_id, [])[:top_references_limit])
            
            # Remove already processed papers to avoid unnecessary API calls
            all_new_paper_ids -= self.added_papers
            
            # Batch fetch all new papers for the next layer at once
            if all_new_paper_ids:
                batch_papers = self.openalex_service.get_papers_batch(list(all_new_paper_ids))
                # Cache all papers at once
                for paper in batch_papers:
                    is_valid, normalized_id = validate_paper_id(paper.id)
                    if is_valid:
                        self.paper_cache[normalized_id] = paper
                        self.paper_cache[paper.id] = paper
            
            # Process all papers in the current level and add their connections
            next_level = []
            edges_to_add = []
            
            for paper_id in current_level:
                is_valid_current, normalized_current_id = validate_paper_id(paper_id)
                if not is_valid_current:
                    continue
                
                # Process citations and references with pre-validation
                for citing_id in citations_map.get(paper_id, [])[:top_cited_limit]:
                    if citing_id not in self.added_papers:
                        is_valid, normalized_citing_id = validate_paper_id(citing_id)
                        if is_valid and self.add_paper_to_graph(citing_id):
                            edges_to_add.append((normalized_current_id, normalized_citing_id))
                            next_level.append(normalized_citing_id)
                
                for ref_id in references_map.get(paper_id, [])[:top_references_limit]:
                    if ref_id not in self.added_papers:
                        is_valid, normalized_ref_id = validate_paper_id(ref_id)
                        if is_valid and self.add_paper_to_graph(ref_id):
                            edges_to_add.append((normalized_current_id, normalized_ref_id))
                            next_level.append(normalized_ref_id)
            
            # Add all edges at once
            self.graph.add_edges_from(edges_to_add)
            current_level = next_level
            
            if not current_level:
                break
        
        return self.get_graph_data()
    
    def build_graph_from_multiple_roots(self, root_paper_ids: List[str], 
                                      iterations: int = 3, top_cited_limit: int = 5, 
                                      top_references_limit: int = 5) -> Dict[str, Any]:
        """
        Build a citation graph starting from multiple root papers.
        
        Args:
            root_paper_ids: List of root paper IDs
            iterations: Number of expansion iterations
            top_cited_limit: Number of top cited papers per iteration
            top_references_limit: Number of top reference papers per iteration
            
        Returns:
            Graph data or error information
        """
        for root_paper_id in root_paper_ids:
            result = self.build_graph_from_root(
                root_paper_id, iterations, top_cited_limit, top_references_limit
            )
            if 'error' in result:
                return result
        
        return self.get_graph_data()
    
    def get_graph_data(self) -> Dict[str, Any]:
        """
        Get the current graph data.
        
        Returns:
            Dictionary containing nodes, edges, and metadata
        """
        if not self.graph.nodes():
            return {
                'nodes': [],
                'edges': [],
                'metadata': {
                    'total_papers': 0,
                    'total_citations': 0,
                    'generated_at': datetime.now().isoformat(),
                    'graph_density': 0.0,
                    'is_connected': False
                }
            }
        
        # Calculate layout with fewer iterations for speed
        pos = nx.spring_layout(self.graph, k=2, iterations=20)
        
        # Build nodes and edges efficiently
        nodes = [
            {
                'id': node_id,
                'title': data.get('title', 'Untitled'),
                'authors': data.get('authors', []),
                'year': data.get('year'),
                'citations': data.get('citations', 0),
                'abstract': data.get('abstract', ''),
                'topics': data.get('topics', []),
                'is_root': data.get('is_root', False),
                'x': pos[node_id][0],
                'y': pos[node_id][1]
            }
            for node_id, data in self.graph.nodes(data=True)
        ]
        
        edges = [
            {'source': source, 'target': target}
            for source, target in self.graph.edges()
        ]
        
        # Calculate metadata
        try:
            is_connected = nx.is_weakly_connected(self.graph)
        except Exception:
            is_connected = False
        
        metadata = {
            'total_nodes': len(nodes),
            'total_edges': len(edges),
            'is_connected': is_connected,
            'num_components': nx.number_weakly_connected_components(self.graph),
            'generated_at': datetime.now().isoformat()
        }
        
        return {
            'nodes': nodes,
            'edges': edges,
            'metadata': metadata
        }
    
    def get_paper_neighbors(self, paper_id: str) -> Dict[str, Any]:
        """
        Get immediate neighbors of a paper in the graph.
        
        Args:
            paper_id: Paper ID
            
        Returns:
            Dictionary with citing and referenced papers
        """
        is_valid, normalized_id = validate_paper_id(paper_id)
        if not is_valid or normalized_id not in self.graph:
            return {'error': 'Paper not in graph'}
        
        citing = []
        for source in self.graph.predecessors(normalized_id):
            data = self.graph.nodes[source]
            citing.append({
                'id': source,
                'title': data.get('title', 'Untitled'),
                'authors': data.get('authors', []),
                'year': data.get('year'),
                'citations': data.get('citations', 0)
            })
        
        references = []
        for target in self.graph.successors(normalized_id):
            data = self.graph.nodes[target]
            references.append({
                'id': target,
                'title': data.get('title', 'Untitled'),
                'authors': data.get('authors', []),
                'year': data.get('year'),
                'citations': data.get('citations', 0)
            })
        
        return {
            'paper_id': normalized_id,
            'citing_papers': citing,
            'referenced_papers': references,
            'total_citing': len(citing),
            'total_referenced': len(references)
        }
    
    def get_graph_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about the current graph.
        
        Returns:
            Dictionary with graph statistics
        """
        if not self.graph.nodes():
            return {'error': 'No graph built yet'}
        
        stats = {
            'total_papers': len(self.graph.nodes()),
            'total_citations': len(self.graph.edges()),
            'density': nx.density(self.graph),
            'is_connected': nx.is_weakly_connected(self.graph),
            'average_degree': sum(dict(self.graph.degree()).values()) / len(self.graph.nodes()) if self.graph.nodes() else 0,
            'max_degree': max(dict(self.graph.degree()).values()) if self.graph.nodes() else 0,
            'components': nx.number_weakly_connected_components(self.graph)
        }
        
        # Get top papers by citation count
        papers_with_citations = []
        for node_id, data in self.graph.nodes(data=True):
            papers_with_citations.append({
                'id': node_id,
                'title': data.get('title', 'Untitled'),
                'citations': data.get('citations', 0),
                'year': data.get('year')
            })
        
        papers_with_citations.sort(key=lambda x: x['citations'], reverse=True)
        stats['top_papers'] = papers_with_citations[:10]
        
        return stats
    
    def add_source_node(self, paper_id: str, expand_from_node: bool = False, 
                       iterations: int = 2, top_cited_limit: int = 3, 
                       top_references_limit: int = 3) -> Dict[str, Any]:
        """
        Add a new source node to the existing graph.
        
        Args:
            paper_id: Paper ID to add as source
            expand_from_node: Whether to expand from this new node
            iterations: Number of expansion iterations (if expand_from_node=True)
            top_cited_limit: Number of top cited papers per iteration
            top_references_limit: Number of top reference papers per iteration
            
        Returns:
            Success message or error information
        """
        is_valid, normalized_id = validate_paper_id(paper_id)
        if not is_valid:
            return {'error': 'Invalid paper ID'}
        
        if normalized_id in self.added_papers:
            return {'error': 'Paper already exists in graph'}
        
        # Add the paper to the graph
        if not self.add_paper_to_graph(paper_id, is_root=True):
            return {'error': 'Could not fetch or add paper to graph'}
        
        result = {
            'message': 'Source node added successfully',
            'paper_id': normalized_id,
            'expanded': False
        }
        
        # Optionally expand from this new node
        if expand_from_node:
            expansion_result = self.expand_from_node(
                paper_id, iterations, top_cited_limit, top_references_limit
            )
            if 'error' not in expansion_result:
                result['expanded'] = True
                result['expansion_details'] = expansion_result
            else:
                result['expansion_error'] = expansion_result['error']
        
        return result
    
    def expand_from_node(self, paper_id: str, iterations: int = 2,
                        top_cited_limit: int = 3, top_references_limit: int = 3) -> Dict[str, Any]:
        """
        Expand the graph from a specific existing node.
        
        Args:
            paper_id: Paper ID to expand from
            iterations: Number of expansion iterations
            top_cited_limit: Number of top cited papers per iteration
            top_references_limit: Number of top reference papers per iteration
            
        Returns:
            Expansion details or error information
        """
        is_valid, normalized_id = validate_paper_id(paper_id)
        if not is_valid:
            return {'error': 'Invalid paper ID'}
        
        if normalized_id not in self.graph:
            return {'error': 'Paper not found in graph'}
        
        initial_paper_count = len(self.graph.nodes())
        current_level = [normalized_id]
        
        for iteration in range(iterations):
            next_level = []
            
            for node_id in current_level:
                # Get citing papers
                citing_papers = self.openalex_service.get_top_cited_papers(
                    node_id, top_cited_limit
                )
                for paper in citing_papers:
                    if self.add_paper_to_graph(paper.id):
                        self.graph.add_edge(paper.id, node_id)
                        next_level.append(paper.id)
                
                # Get reference papers
                reference_papers = self.openalex_service.get_top_reference_papers(
                    node_id, top_references_limit
                )
                for paper in reference_papers:
                    if self.add_paper_to_graph(paper.id):
                        self.graph.add_edge(node_id, paper.id)
                        next_level.append(paper.id)
            
            current_level = next_level
            if not current_level:
                break
        
        final_paper_count = len(self.graph.nodes())
        new_papers_added = final_paper_count - initial_paper_count
        
        return {
            'message': f'Expansion completed from {paper_id}',
            'iterations_completed': iterations,
            'initial_papers': initial_paper_count,
            'final_papers': final_paper_count,
            'new_papers_added': new_papers_added
        }
    
    def remove_node_with_connections(self, paper_id: str, 
                                   remove_orphaned: bool = False) -> Dict[str, Any]:
        """
        Remove a node and optionally its orphaned connections.
        
        Args:
            paper_id: Paper ID to remove
            remove_orphaned: Whether to remove nodes that become orphaned
            
        Returns:
            Removal details or error information
        """
        is_valid, normalized_id = validate_paper_id(paper_id)
        if not is_valid:
            return {'error': 'Invalid paper ID'}
        
        if normalized_id not in self.graph:
            return {'error': 'Paper not found in graph'}
        
        # Get connected nodes before removal
        connected_nodes = set()
        for edge in self.graph.edges(normalized_id):
            connected_nodes.update(edge)
        
        # Remove the node
        if not self.remove_paper_from_graph(paper_id):
            return {'error': 'Failed to remove paper from graph'}
        
        result = {
            'message': 'Node removed successfully',
            'removed_paper_id': normalized_id,
            'connected_nodes_affected': list(connected_nodes),
            'orphaned_nodes_removed': []
        }
        
        # Optionally remove orphaned nodes
        if remove_orphaned:
            orphaned_nodes = []
            for node_id in list(self.graph.nodes()):
                if self.graph.degree(node_id) == 0:
                    orphaned_nodes.append(node_id)
                    self.remove_paper_from_graph(node_id)
            
            result['orphaned_nodes_removed'] = orphaned_nodes
            result['orphaned_count'] = len(orphaned_nodes)
        
        return result
    
    def get_node_info(self, paper_id: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific node in the graph.
        
        Args:
            paper_id: Paper ID
            
        Returns:
            Node information or error
        """
        is_valid, normalized_id = validate_paper_id(paper_id)
        if not is_valid:
            return {'error': 'Invalid paper ID'}
        
        if normalized_id not in self.graph:
            return {'error': 'Paper not found in graph'}
        
        node_data = self.graph.nodes[normalized_id]
        neighbors = self.get_paper_neighbors(paper_id)
        
        return {
            'paper_id': normalized_id,
            'node_data': node_data,
            'neighbors': neighbors,
            'degree': self.graph.degree(normalized_id),
            'in_degree': self.graph.in_degree(normalized_id),
            'out_degree': self.graph.out_degree(normalized_id)
        }
    
    def clear_graph(self) -> Dict[str, Any]:
        """Clear the current graph and return confirmation."""
        initial_count = len(self.graph.nodes())
        self.graph.clear()
        self.added_papers.clear()
        self.openalex_service.paper_cache.clear()
        
        return {
            'message': 'Graph cleared successfully',
            'papers_removed': initial_count,
            'cleared_at': datetime.now().isoformat()
        }
