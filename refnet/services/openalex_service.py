"""Service for interacting with OpenAlex API."""

from typing import Dict, List, Optional, Any
import requests
import json
from ..models.paper import Paper, PaperFormatter
from ..utils.rate_limiter import RateLimiter
from ..utils.validators import validate_paper_id


class OpenAlexService:
    """Service for interacting with OpenAlex API."""
    
    def __init__(self, rate_limit_delay: float = 0.2):
        """
        Initialize OpenAlex service.
        
        Args:
            rate_limit_delay: Delay between API calls in seconds
        """
        self.base_url = "https://api.openalex.org"
        self.rate_limiter = RateLimiter(delay=rate_limit_delay)
        self.paper_cache: Dict[str, Paper] = {}
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'RefNet/1.0 (https://github.com/your-repo/refnet)',
            'Accept': 'application/json'
        })
    
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
            
            # Build URL
            url = f"{self.base_url}/works"
            params = {
                'filter': f'title.search:{query}',  # Search specifically in titles using filter
                'page': page,
                'per-page': min(per_page, 200),  # OpenAlex max is 200
                'sort': f'{sort_by}:desc'
            }
            
            print(f"🔍 Searching papers: {query}")
            response = self.session.get(url, params=params)
            response.raise_for_status()
            
            data = response.json()
            
            if 'results' in data:
                print(f"✅ Found {len(data['results'])} papers")
                return {
                    'results': data['results'],
                    'meta': data.get('meta', {})
                }
            
            return None
        
        except Exception as e:
            print(f"❌ Search failed: {e}")
            return None
    
    def format_raw_paper_data(self, raw_paper: Dict[str, Any]) -> Optional[Paper]:
        """
        Format raw paper data from search results into a Paper object.
        This is much faster than making individual API calls.
        
        Args:
            raw_paper: Raw paper data from search results
            
        Returns:
            Paper object or None if invalid
        """
        try:
            return PaperFormatter.format_paper_data(raw_paper)
        except Exception as e:
            print(f"❌ Failed to format raw paper data: {e}")
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
        
        # Add retry logic with requests
        import time
        max_retries = 3
        
        for attempt in range(max_retries + 1):
            try:
                self.rate_limiter.wait_if_needed()
                print(f"🔍 Attempt {attempt + 1}: Getting paper {normalized_id}")
                
                # Use requests instead of pyalex
                url = f"{self.base_url}/works/{normalized_id}"
                response = self.session.get(url)
                response.raise_for_status()
                
                raw_paper = response.json()
                
                if raw_paper:
                    paper = PaperFormatter.format_paper_data(raw_paper)
                    if paper:
                        print(f"✅ Success: Found paper '{paper.title[:50]}...'")
                        self.paper_cache[normalized_id] = paper
                        return paper
                    else:
                        print(f"⚠️  Attempt {attempt + 1}: Paper data invalid")
                else:
                    print(f"⚠️  Attempt {attempt + 1}: Paper not found")
                
                return None
                    
            except Exception as e:
                print(f"❌ Attempt {attempt + 1} failed: {e}")
                if attempt < max_retries:
                    wait_time = 2 ** attempt  # Exponential backoff
                    print(f"⏳ Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                else:
                    print(f"💥 All {max_retries + 1} attempts failed")
        
        return None
    
    def get_citing_papers(self, paper_id: str, page: int = 1, 
                         per_page: int = 25, max_retries: int = 3) -> Optional[Dict[str, Any]]:
        """
        Get papers that cite the given paper with retry logic.
        
        Args:
            paper_id: Paper ID
            page: Page number
            per_page: Results per page
            max_retries: Maximum number of retry attempts
            
        Returns:
            Citing papers or None if failed
        """
        import time
        
        for attempt in range(max_retries + 1):
            try:
                self.rate_limiter.wait_if_needed()
                
                # Normalize paper ID
                if paper_id.startswith('10.'):
                    normalized_id = f"https://doi.org/{paper_id}"
                elif not paper_id.startswith('https://openalex.org/'):
                    normalized_id = f"https://openalex.org/{paper_id}"
                else:
                    normalized_id = paper_id
                
                print(f"🔍 Attempt {attempt + 1}: Getting citations for {normalized_id}")
                
                # Use requests instead of pyalex
                url = f"{self.base_url}/works"
                params = {
                    'filter': f'cites:{normalized_id}',
                    'sort': 'cited_by_count:desc',
                    'per-page': min(per_page, 200),
                    'page': page
                }
                
                response = self.session.get(url, params=params)
                response.raise_for_status()
                
                data = response.json()
                results = data.get('results', [])
                meta = data.get('meta', {})
                
                if results is not None:
                    print(f"✅ Success: Found {len(results)} citations")
                    return {
                        'results': results,
                        'meta': meta
                    }
                else:
                    print(f"⚠️  Attempt {attempt + 1}: No results returned")
                    
            except Exception as e:
                print(f"❌ Attempt {attempt + 1} failed: {e}")
                if attempt < max_retries:
                    wait_time = 2 ** attempt  # Exponential backoff
                    print(f"⏳ Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                else:
                    print(f"💥 All {max_retries + 1} attempts failed")
        
        return None
    
    def get_paper_references(self, paper_id: str) -> Optional[List[str]]:
        """
        Get reference IDs for a paper.
        
        Args:
            paper_id: Paper ID
            
        Returns:
            List of reference IDs or None if failed
        """
        # Don't call get_paper_by_id here to avoid recursion
        # We'll get the paper data directly
        
        # Get raw paper data to access referenced_works with retry logic
        import time
        max_retries = 3
        
        for attempt in range(max_retries + 1):
            try:
                self.rate_limiter.wait_if_needed()
                
                if paper_id.startswith('10.'):
                    normalized_id = f"https://doi.org/{paper_id}"
                elif not paper_id.startswith('https://openalex.org/'):
                    normalized_id = f"https://openalex.org/{paper_id}"
                else:
                    normalized_id = paper_id
                
                print(f"🔍 Attempt {attempt + 1}: Getting references for {normalized_id}")
                
                # Use requests instead of pyalex
                url = f"{self.base_url}/works/{normalized_id}"
                response = self.session.get(url)
                response.raise_for_status()
                
                raw_paper = response.json()
                if raw_paper and isinstance(raw_paper.get('referenced_works'), list):
                    references = raw_paper['referenced_works']
                    # Extract just the paper ID from the full OpenAlex URL
                    reference_ids = []
                    for ref_url in references:
                        if ref_url and 'openalex.org/' in ref_url:
                            ref_id = ref_url.split('openalex.org/')[-1]
                            reference_ids.append(ref_id)
                        elif ref_url:
                            reference_ids.append(ref_url)
                    print(f"✅ Success: Found {len(reference_ids)} references")
                    return reference_ids
                else:
                    print(f"⚠️  Attempt {attempt + 1}: No references found")
                    return []
                    
            except Exception as e:
                print(f"❌ Attempt {attempt + 1} failed: {e}")
                if attempt < max_retries:
                    wait_time = 2 ** attempt  # Exponential backoff
                    print(f"⏳ Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                else:
                    print(f"💥 All {max_retries + 1} attempts failed")
        
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
    
    def get_papers_batch(self, paper_ids: List[str]) -> List[Paper]:
        """
        Get multiple papers in a single API call using batch retrieval.
        
        Args:
            paper_ids: List of paper IDs to fetch
            
        Returns:
            List of Paper objects
        """
        if not paper_ids:
            return []
        
        try:
            self.rate_limiter.wait_if_needed()
            
            # Create filter for multiple OpenAlex IDs
            # Convert to proper OpenAlex format if needed
            openalex_ids = []
            for paper_id in paper_ids:
                is_valid, normalized_id = validate_paper_id(paper_id)
                if is_valid:
                    if not normalized_id.startswith('https://openalex.org/'):
                        normalized_id = f"https://openalex.org/{normalized_id}"
                    openalex_ids.append(normalized_id)
            
            if not openalex_ids:
                return []
            
            # Create filter string for batch retrieval
            ids_filter = '|'.join(openalex_ids)
            
            # Use requests instead of pyalex
            url = f"{self.base_url}/works"
            params = {
                'filter': f'openalex:{ids_filter}',
                'per-page': 50  # Reduced batch size to avoid rate limits
            }
            try:
                response = self.session.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                response = data.get('results', [])
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 429:
                    print(f"⚠️  Rate limit hit in batch processing, reducing batch size...")
                    # Fall back to individual requests for smaller batches
                    return self._get_papers_individually(paper_ids)
                else:
                    raise
            
            papers = []
            if response:
                for work_data in response:
                    paper = PaperFormatter.format_paper_data(work_data)
                    if paper:
                        papers.append(paper)
                        # Cache the paper
                        self.paper_cache[paper.id] = paper
            else:
                # Fallback to individual calls if batch fails
                for paper_id in paper_ids:
                    paper = self.get_paper_by_id(paper_id)
                    if paper:
                        papers.append(paper)
            
            return papers
        
        except Exception as e:
            print(f"Error in batch paper retrieval: {e}")
            return []
    
    def _get_papers_individually(self, paper_ids: List[str]) -> List[Paper]:
        """
        Fallback method to get papers individually when batch processing fails.
        """
        papers = []
        for paper_id in paper_ids[:10]:  # Limit to first 10 to avoid too many requests
            try:
                paper = self.get_paper_by_id(paper_id)
                if paper:
                    papers.append(paper)
                time.sleep(0.05)  # Add small delay between individual requests
            except Exception as e:
                print(f"Error getting individual paper {paper_id}: {e}")
                continue
        return papers
    
    def get_citations_batch(self, paper_ids: List[str]) -> Dict[str, List[str]]:
        """
        Get citations for multiple papers efficiently using batch API.
        
        Args:
            paper_ids: List of paper IDs
            
        Returns:
            Dictionary mapping paper_id to list of citing paper IDs
        """
        if not paper_ids:
            return {}
        
        citations_map = {}
        
        try:
            # Use batch API call for citations
            self.rate_limiter.wait_if_needed()
            
            # Create filter for multiple papers
            openalex_ids = []
            for paper_id in paper_ids:
                is_valid, normalized_id = validate_paper_id(paper_id)
                if is_valid:
                    if not normalized_id.startswith('https://openalex.org/'):
                        normalized_id = f"https://openalex.org/{normalized_id}"
                    openalex_ids.append(normalized_id)
            
            if not openalex_ids:
                return {paper_id: [] for paper_id in paper_ids}
            
            # Use pyalex to get citations for multiple papers
            # This is a simplified approach - in practice, you'd need to make separate calls
            # for each paper's citations, but we can optimize by reducing individual calls
            for i, paper_id in enumerate(paper_ids):
                if i > 0:  # Add small delay between calls
                    self.rate_limiter.wait_if_needed()
                
                is_valid, normalized_id = validate_paper_id(paper_id)
                if not is_valid:
                    citations_map[paper_id] = []
                    continue
                
                # Get citations for this paper
                citing_papers = self.get_citing_papers(normalized_id, page=1, per_page=200)
                if citing_papers and 'results' in citing_papers:
                    # Extract just the paper ID from the full OpenAlex URL
                    citation_ids = []
                    for c in citing_papers['results']:
                        paper_id_full = c.get('id', '')
                        if paper_id_full:
                            # Extract just the ID part from https://openalex.org/W1234567890
                            if 'openalex.org/' in paper_id_full:
                                citation_id = paper_id_full.split('openalex.org/')[-1]
                                citation_ids.append(citation_id)
                            else:
                                citation_ids.append(paper_id_full)
                    citations_map[paper_id] = citation_ids
                else:
                    citations_map[paper_id] = []
            
            return citations_map
            
        except Exception as e:
            print(f"Error in batch citations retrieval: {e}")
            return {paper_id: [] for paper_id in paper_ids}
    
    def get_references_batch(self, paper_ids: List[str]) -> Dict[str, List[str]]:
        """
        Get references for multiple papers efficiently.
        
        Args:
            paper_ids: List of paper IDs
            
        Returns:
            Dictionary mapping paper_id to list of reference paper IDs
        """
        if not paper_ids:
            return {}
        
        references_map = {}
        
        try:
            for i, paper_id in enumerate(paper_ids):
                if i > 0:  # Add small delay between calls
                    self.rate_limiter.wait_if_needed()
                
                is_valid, normalized_id = validate_paper_id(paper_id)
                if not is_valid:
                    references_map[paper_id] = []
                    continue
                
                # Get references for this paper
                references = self.get_paper_references(normalized_id)
                references_map[paper_id] = references if references else []
            
            return references_map
            
        except Exception as e:
            print(f"Error in batch references retrieval: {e}")
            return {paper_id: [] for paper_id in paper_ids}

