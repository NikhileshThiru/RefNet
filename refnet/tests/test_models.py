"""Tests for RefNet models."""

import unittest
from datetime import datetime

from refnet.models.paper import Paper, PaperFormatter
from refnet.models.graph import GraphMetadata, GraphNode, GraphEdge


class TestPaper(unittest.TestCase):
    """Test cases for Paper model."""
    
    def test_paper_creation(self):
        """Test creating a Paper object."""
        paper = Paper(
            id="test-id",
            title="Test Paper",
            authors=["Author 1", "Author 2"],
            year=2023,
            abstract="Test abstract",
            doi="10.1000/test",
            citations=10,
            venue="Test Venue",
            topics=["AI", "ML"],
            type="journal-article",
            language="en",
            is_open_access=True,
            openalex_url="https://openalex.org/test-id",
            pdf_url="https://example.com/paper.pdf",
            publication_date="2023-01-01",
            referenced_works_count=20,
            related_works_count=5
        )
        
        self.assertEqual(paper.id, "test-id")
        self.assertEqual(paper.title, "Test Paper")
        self.assertEqual(len(paper.authors), 2)
        self.assertEqual(paper.year, 2023)
        self.assertTrue(paper.is_open_access)
    
    def test_paper_to_dict(self):
        """Test converting Paper to dictionary."""
        paper = Paper(
            id="test-id",
            title="Test Paper",
            authors=["Author 1"],
            year=2023,
            abstract="Test abstract",
            doi="10.1000/test",
            citations=10,
            venue="Test Venue",
            topics=["AI"],
            type="journal-article",
            language="en",
            is_open_access=True,
            openalex_url="https://openalex.org/test-id",
            pdf_url=None,
            publication_date="2023-01-01",
            referenced_works_count=20,
            related_works_count=5
        )
        
        paper_dict = paper.to_dict()
        self.assertIsInstance(paper_dict, dict)
        self.assertEqual(paper_dict['id'], "test-id")
        self.assertEqual(paper_dict['title'], "Test Paper")
        self.assertEqual(paper_dict['citations'], 10)


class TestPaperFormatter(unittest.TestCase):
    """Test cases for PaperFormatter."""
    
    def test_format_valid_paper(self):
        """Test formatting a valid paper."""
        raw_paper = {
            'id': 'https://openalex.org/test-id',
            'title': 'Test Paper',
            'authorships': [
                {'author': {'display_name': 'Author 1'}},
                {'author': {'display_name': 'Author 2'}}
            ],
            'publication_year': 2023,
            'abstract': 'This is a test abstract that is short.',
            'doi': 'https://doi.org/10.1000/test',
            'cited_by_count': 10,
            'primary_location': {
                'source': {'display_name': 'Test Venue'}
            },
            'type': 'journal-article',
            'language': 'en',
            'open_access': {'is_oa': True, 'oa_url': 'https://example.com/paper.pdf'},
            'publication_date': '2023-01-01',
            'referenced_works': ['ref1', 'ref2'],
            'related_works': ['rel1']
        }
        
        paper = PaperFormatter.format_paper_data(raw_paper)
        self.assertIsNotNone(paper)
        self.assertEqual(paper.title, 'Test Paper')
        self.assertEqual(len(paper.authors), 2)
        self.assertEqual(paper.year, 2023)
        self.assertTrue(paper.is_open_access)
    
    def test_format_invalid_paper(self):
        """Test formatting an invalid paper."""
        # Test with None
        paper = PaperFormatter.format_paper_data(None)
        self.assertIsNone(paper)
        
        # Test with empty dict
        paper = PaperFormatter.format_paper_data({})
        self.assertIsNone(paper)
        
        # Test with invalid data type
        paper = PaperFormatter.format_paper_data("invalid")
        self.assertIsNone(paper)


class TestGraphMetadata(unittest.TestCase):
    """Test cases for GraphMetadata."""
    
    def test_graph_metadata_creation(self):
        """Test creating GraphMetadata object."""
        metadata = GraphMetadata(
            total_papers=10,
            total_citations=20,
            generated_at=datetime.now().isoformat(),
            graph_density=0.5,
            is_connected=True,
            average_degree=2.0,
            max_degree=5,
            components=1
        )
        
        self.assertEqual(metadata.total_papers, 10)
        self.assertEqual(metadata.total_citations, 20)
        self.assertEqual(metadata.graph_density, 0.5)
        self.assertTrue(metadata.is_connected)
    
    def test_graph_metadata_to_dict(self):
        """Test converting GraphMetadata to dictionary."""
        metadata = GraphMetadata(
            total_papers=10,
            total_citations=20,
            generated_at=datetime.now().isoformat(),
            graph_density=0.5,
            is_connected=True
        )
        
        metadata_dict = metadata.to_dict()
        self.assertIsInstance(metadata_dict, dict)
        self.assertEqual(metadata_dict['total_papers'], 10)
        self.assertEqual(metadata_dict['total_citations'], 20)


if __name__ == '__main__':
    unittest.main()
