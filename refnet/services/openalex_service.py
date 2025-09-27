"""Service for interacting with OpenAlex API."""

from typing import Dict, List, Optional, Any
from pyalex import Works
from ..models.paper import Paper, PaperFormatter
from ..utils.rate_limiter import RateLimiter


class OpenAlexService:
    """Service for interacting with OpenAlex API."""
    
    def __init__(self, rate_limit_delay: float = 0.2):
        """
        Initialize OpenAlex service.
        
        Args:
            rate_limit_delay: Delay between API calls in seconds
        """
        self.works = Works()
        self.rate_limiter = RateLimiter(delay=rate_limit_delay)
        self.paper_cache: Dict[str, Paper] = {}
    
    def search_papers(self, query: str, page: int = 1, per_page: int = 25, 
                     sort_by: str = 'cited_by_count') -> Optional[Dict[str, Any]]:
        """
        Search for papers using OpenAlex API.
        
        Args:
            query: Search query
            page: Page number
            per_page: Results per page
            sort_by: Sort criteria
            
        Returns:
            Search results or None if failed
        """
        try:
            self.rate_limiter.wait_if_needed()
            
            works_query = self.works.search(query)
            
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
        
        except Exception:
            return None
    
    def get_paper_by_id(self, paper_id: str) -> Optional[Paper]:
        """
        Get a paper by its ID.
        
        Args:
            paper_id: Paper ID or DOI
            
        Returns:
            Paper object or None if not found
        """
        # Normalize paper ID
        if paper_id.startswith('10.'):
            normalized_id = f"https://doi.org/{paper_id}"
        elif not paper_id.startswith('https://openalex.org/'):
            normalized_id = f"https://openalex.org/{paper_id}"
        else:
            normalized_id = paper_id
        
        # Check cache first
        if normalized_id in self.paper_cache:
            return self.paper_cache[normalized_id]
        
        try:
            self.rate_limiter.wait_if_needed()
            raw_paper = self.works[normalized_id]
            
            if raw_paper:
                paper = PaperFormatter.format_paper_data(raw_paper)
                if paper:
                    self.paper_cache[normalized_id] = paper
                return paper
            
            return None
        
        except Exception:
            return None
    
    def get_citing_papers(self, paper_id: str, page: int = 1, 
                         per_page: int = 25) -> Optional[Dict[str, Any]]:
        """
        Get papers that cite the given paper.
        
        Args:
            paper_id: Paper ID
            page: Page number
            per_page: Results per page
            
        Returns:
            Citing papers or None if failed
        """
        try:
            self.rate_limiter.wait_if_needed()
            
            # Normalize paper ID
            if paper_id.startswith('10.'):
                normalized_id = f"https://doi.org/{paper_id}"
            elif not paper_id.startswith('https://openalex.org/'):
                normalized_id = f"https://openalex.org/{paper_id}"
            else:
                normalized_id = paper_id
            
            citing_papers = self.works.filter(cites=normalized_id).sort(cited_by_count='desc')
            results = citing_papers.get(per_page=per_page, page=page)
            meta = citing_papers.meta
            
            return {
                'results': results,
                'meta': meta
            }
        
        except Exception:
            return None
    
    def get_paper_references(self, paper_id: str) -> Optional[List[str]]:
        """
        Get reference IDs for a paper.
        
        Args:
            paper_id: Paper ID
            
        Returns:
            List of reference IDs or None if failed
        """
        paper = self.get_paper_by_id(paper_id)
        if not paper:
            return None
        
        # Get raw paper data to access referenced_works
        try:
            self.rate_limiter.wait_if_needed()
            
            if paper_id.startswith('10.'):
                normalized_id = f"https://doi.org/{paper_id}"
            elif not paper_id.startswith('https://openalex.org/'):
                normalized_id = f"https://openalex.org/{paper_id}"
            else:
                normalized_id = paper_id
            
            raw_paper = self.works[normalized_id]
            if raw_paper and isinstance(raw_paper.get('referenced_works'), list):
                return raw_paper['referenced_works']
            
            return []
        
        except Exception:
            return []
    
    def get_top_cited_papers(self, paper_id: str, limit: int = 10) -> List[Paper]:
        """
        Get top cited papers that cite the given paper.
        
        Args:
            paper_id: Paper ID
            limit: Maximum number of papers to return
            
        Returns:
            List of Paper objects
        """
        citing_data = self.get_citing_papers(paper_id, per_page=limit)
        if not citing_data or not citing_data.get('results'):
            return []
        
        papers = []
        for raw_paper in citing_data['results']:
            paper = PaperFormatter.format_paper_data(raw_paper)
            if paper:
                papers.append(paper)
        
        return papers
    
    def get_top_reference_papers(self, paper_id: str, limit: int = 10) -> List[Paper]:
        """
        Get top reference papers for the given paper.
        
        Args:
            paper_id: Paper ID
            limit: Maximum number of papers to return
            
        Returns:
            List of Paper objects sorted by citation count
        """
        reference_ids = self.get_paper_references(paper_id)
        if not reference_ids:
            return []
        
        papers = []
        for ref_id in reference_ids[:limit * 2]:  # Get more than needed for sorting
            if ref_id:
                paper = self.get_paper_by_id(ref_id)
                if paper:
                    papers.append(paper)
        
        # Sort by citation count and return top papers
        papers.sort(key=lambda x: x.citations, reverse=True)
        return papers[:limit]

