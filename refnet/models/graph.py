"""Graph data models and metadata."""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class GraphMetadata:
    """Metadata about a citation graph."""
    
    total_papers: int
    total_citations: int
    generated_at: str
    graph_density: float
    is_connected: bool
    average_degree: Optional[float] = None
    max_degree: Optional[int] = None
    components: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metadata to dictionary for JSON serialization."""
        return {
            'total_papers': self.total_papers,
            'total_citations': self.total_citations,
            'generated_at': self.generated_at,
            'graph_density': self.graph_density,
            'is_connected': self.is_connected,
            'average_degree': self.average_degree,
            'max_degree': self.max_degree,
            'components': self.components
        }


@dataclass
class GraphNode:
    """Represents a node in the citation graph."""
    
    id: str
    title: str
    authors: List[str]
    year: Optional[int]
    citations: int
    venue: Optional[str]
    topics: List[str]
    is_open_access: bool
    pdf_url: Optional[str]
    doi: Optional[str]
    abstract: str
    type: str
    publication_date: Optional[str]
    referenced_works_count: int
    related_works_count: int
    x: float
    y: float
    degree: int
    in_degree: int
    out_degree: int
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert node to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'title': self.title,
            'authors': self.authors,
            'year': self.year,
            'citations': self.citations,
            'venue': self.venue,
            'topics': self.topics,
            'is_open_access': self.is_open_access,
            'pdf_url': self.pdf_url,
            'doi': self.doi,
            'abstract': self.abstract,
            'type': self.type,
            'publication_date': self.publication_date,
            'referenced_works_count': self.referenced_works_count,
            'related_works_count': self.related_works_count,
            'x': self.x,
            'y': self.y,
            'degree': self.degree,
            'in_degree': self.in_degree,
            'out_degree': self.out_degree
        }


@dataclass
class GraphEdge:
    """Represents an edge in the citation graph."""
    
    source: str
    target: str
    type: str = 'citation'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert edge to dictionary for JSON serialization."""
        return {
            'source': self.source,
            'target': self.target,
            'type': self.type
        }


@dataclass
class GraphData:
    """Complete graph data structure."""
    
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    metadata: GraphMetadata
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert graph data to dictionary for JSON serialization."""
        return {
            'nodes': [node.to_dict() for node in self.nodes],
            'edges': [edge.to_dict() for edge in self.edges],
            'metadata': self.metadata.to_dict()
        }

