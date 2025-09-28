"""Paper data models and formatting utilities."""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class Paper:
    """Represents a research paper with all its metadata."""
    
    id: str
    title: str
    authors: List[str]
    year: Optional[int]
    abstract: str
    doi: Optional[str]
    citations: int
    venue: Optional[str]
    topics: List[str]
    type: str
    language: str
    is_open_access: bool
    openalex_url: str
    pdf_url: Optional[str]
    publication_date: Optional[str]
    referenced_works_count: int
    related_works_count: int
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert paper to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'title': self.title,
            'authors': self.authors,
            'year': self.year,
            'abstract': self.abstract,
            'doi': self.doi,
            'citations': self.citations,
            'venue': self.venue,
            'topics': self.topics,
            'type': self.type,
            'language': self.language,
            'is_open_access': self.is_open_access,
            'openalex_url': self.openalex_url,
            'pdf_url': self.pdf_url,
            'publication_date': self.publication_date,
            'referenced_works_count': self.referenced_works_count,
            'related_works_count': self.related_works_count
        }


class PaperFormatter:
    """Handles formatting of raw paper data from OpenAlex API."""
    
    @staticmethod
    def format_paper_data(paper: Dict[str, Any]) -> Optional[Paper]:
        """
        Convert raw OpenAlex paper data to a Paper object.
        
        Args:
            paper: Raw paper data from OpenAlex API
            
        Returns:
            Formatted Paper object or None if formatting fails
        """
        if not paper or not isinstance(paper, dict):
            return None
            
        try:
            # Extract publication year
            pub_year = paper.get('publication_year')
            if pub_year is None:
                # Try to extract year from publication_date
                pub_date = paper.get('publication_date', '')
                if pub_date and len(pub_date) >= 4:
                    try:
                        pub_year = int(pub_date[:4])
                    except (ValueError, TypeError):
                        pub_year = None
            
            # Extract authors
            authors = []
            if isinstance(paper.get('authorships'), list):
                for authorship in paper['authorships']:
                    if isinstance(authorship, dict):
                        author = authorship.get('author', {})
                        if isinstance(author, dict):
                            display_name = author.get('display_name', '')
                            # Only add authors with valid names
                            if display_name and display_name.strip() and display_name != 'Unknown Author':
                                authors.append(display_name)
            
            # If no authors found, leave empty (will be filtered out by graph service)
            if not authors:
                authors = []
            
            # Extract abstract
            abstract_text = ""
            if isinstance(paper.get('abstract'), str):
                abstract_text = paper['abstract']
                if len(abstract_text) > 500:
                    abstract_text = abstract_text[:500] + "..."
            
            # Extract topics/concepts
            topics = []
            if isinstance(paper.get('concepts'), list):
                for concept in paper['concepts'][:5]:
                    if isinstance(concept, dict):
                        topics.append(concept.get('display_name', ''))
            
            # Extract DOI
            doi = None
            if isinstance(paper.get('doi'), str):
                doi = paper['doi'].replace('https://doi.org/', '')
            
            # Extract citation count
            citations = paper.get('cited_by_count', 0)
            if not isinstance(citations, (int, float)):
                citations = 0
            
            # Citations extracted successfully
            
            # Extract venue
            venue = None
            primary_location = paper.get('primary_location', {})
            if isinstance(primary_location, dict):
                source = primary_location.get('source', {})
                if isinstance(source, dict):
                    venue = source.get('display_name', 'Unknown Venue')
            
            # Extract publication type and language
            pub_type = paper.get('type', 'Unknown')
            language = paper.get('language', 'Unknown')
            
            # Extract open access information
            open_access = paper.get('open_access', {})
            if isinstance(open_access, dict):
                is_oa = open_access.get('is_oa', False)
                oa_url = open_access.get('oa_url', None)
            else:
                is_oa = False
                oa_url = None
            
            # Extract reference counts
            referenced_works = paper.get('referenced_works', [])
            related_works = paper.get('related_works', [])
            
            referenced_count = len(referenced_works) if isinstance(referenced_works, list) else 0
            related_count = len(related_works) if isinstance(related_works, list) else 0
            
            return Paper(
                id=paper.get('id', ''),
                title=paper.get('title', 'Untitled'),
                authors=authors,
                year=pub_year,
                abstract=abstract_text,
                doi=doi,
                citations=citations,
                venue=venue,
                topics=topics,
                type=pub_type,
                language=language,
                is_open_access=is_oa,
                openalex_url=paper.get('id', ''),
                pdf_url=oa_url,
                publication_date=paper.get('publication_date'),
                referenced_works_count=referenced_count,
                related_works_count=related_count
            )
            
        except Exception:
            # If formatting fails, return None
            return None

