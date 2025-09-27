"""API routes for RefNet."""

from .search_routes import search_bp
from .paper_routes import paper_bp
from .graph_routes import graph_bp

__all__ = ['search_bp', 'paper_bp', 'graph_bp']

