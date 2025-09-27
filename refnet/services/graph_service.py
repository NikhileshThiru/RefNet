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
    
    def add_paper_to_graph(self, paper_id: str, is_root: bool = False) -> bool:
        """
        Add a paper to the graph.
        
        Args:
            paper_id: Paper ID to add
            is_root: Whether this is a root paper
            
        Returns:
            True if successfully added, False otherwise
        """
        is_valid, normalized_id = validate_paper_id(paper_id)
        if not is_valid or normalized_id in self.added_papers:
            return False
        
        paper = self.openalex_service.get_paper_by_id(paper_id)
        if not paper:
            return False
        
        # Add node to graph
        self.graph.add_node(normalized_id, **paper.to_dict())
        self.added_papers.add(normalized_id)
        return True
    
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
    
    def build_graph_from_root(self, root_paper_id: str, iterations: int = 3,
                            top_cited_limit: int = 5, top_references_limit: int = 5) -> Dict[str, Any]:
        """
        Build a citation graph starting from a root paper.
        
        Args:
            root_paper_id: ID of the root paper
            iterations: Number of expansion iterations
            top_cited_limit: Number of top cited papers per iteration
            top_references_limit: Number of top reference papers per iteration
            
        Returns:
            Graph data or error information
        """
        if not self.add_paper_to_graph(root_paper_id, is_root=True):
            return {'error': 'Could not fetch root paper'}
        
        is_valid, normalized_id = validate_paper_id(root_paper_id)
        if not is_valid:
            return {'error': 'Invalid paper ID'}
        
        current_level = [normalized_id]
        
        for _ in range(iterations):
            next_level = []
            
            for paper_id in current_level:
                # Get citing papers
                citing_papers = self.openalex_service.get_top_cited_papers(
                    paper_id, top_cited_limit
                )
                for paper in citing_papers:
                    if self.add_paper_to_graph(paper.id):
                        self.graph.add_edge(paper.id, paper_id)
                        next_level.append(paper.id)
                
                # Get reference papers
                reference_papers = self.openalex_service.get_top_reference_papers(
                    paper_id, top_references_limit
                )
                for paper in reference_papers:
                    if self.add_paper_to_graph(paper.id):
                        self.graph.add_edge(paper_id, paper.id)
                        next_level.append(paper.id)
            
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
        
        # Calculate layout
        pos = nx.spring_layout(self.graph, k=3, iterations=50)
        
        # Build nodes
        nodes = []
        for node_id, data in self.graph.nodes(data=True):
            node = GraphNode(
                id=node_id,
                title=data.get('title', 'Untitled'),
                authors=data.get('authors', []),
                year=data.get('year'),
                citations=data.get('citations', 0),
                venue=data.get('venue'),
                topics=data.get('topics', []),
                is_open_access=data.get('is_open_access', False),
                pdf_url=data.get('pdf_url'),
                doi=data.get('doi'),
                abstract=data.get('abstract', ''),
                type=data.get('type'),
                publication_date=data.get('publication_date'),
                referenced_works_count=data.get('referenced_works_count', 0),
                related_works_count=data.get('related_works_count', 0),
                x=pos[node_id][0],
                y=pos[node_id][1],
                degree=self.graph.degree(node_id),
                in_degree=self.graph.in_degree(node_id),
                out_degree=self.graph.out_degree(node_id)
            )
            nodes.append(node)
        
        # Build edges
        edges = []
        for source, target in self.graph.edges():
            edge = GraphEdge(source=source, target=target, type='citation')
            edges.append(edge)
        
        # Calculate metadata
        try:
            is_connected = nx.is_weakly_connected(self.graph)
        except Exception:
            is_connected = False
        
        metadata = GraphMetadata(
            total_papers=len(nodes),
            total_citations=len(edges),
            generated_at=datetime.now().isoformat(),
            graph_density=nx.density(self.graph),
            is_connected=is_connected,
            average_degree=sum(dict(self.graph.degree()).values()) / len(self.graph.nodes()) if self.graph.nodes() else 0,
            max_degree=max(dict(self.graph.degree()).values()) if self.graph.nodes() else 0,
            components=nx.number_weakly_connected_components(self.graph)
        )
        
        graph_data = GraphData(nodes=nodes, edges=edges, metadata=metadata)
        return graph_data.to_dict()
    
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
    
    def clear_graph(self) -> None:
        """Clear the current graph."""
        self.graph.clear()
        self.added_papers.clear()
        self.openalex_service.paper_cache.clear()
