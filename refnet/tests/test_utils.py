"""Tests for RefNet utilities."""

import unittest

from refnet.utils.validators import validate_paper_id, validate_search_params, validate_graph_params
from refnet.utils.rate_limiter import RateLimiter


class TestValidators(unittest.TestCase):
    """Test cases for validation utilities."""
    
    def test_validate_paper_id_doi(self):
        """Test validating DOI paper ID."""
        is_valid, normalized_id = validate_paper_id("10.1000/test")
        self.assertTrue(is_valid)
        self.assertEqual(normalized_id, "https://doi.org/10.1000/test")
    
    def test_validate_paper_id_openalex(self):
        """Test validating OpenAlex paper ID."""
        is_valid, normalized_id = validate_paper_id("W1234567890")
        self.assertTrue(is_valid)
        self.assertEqual(normalized_id, "https://openalex.org/W1234567890")
    
    def test_validate_paper_id_full_url(self):
        """Test validating full URL paper ID."""
        is_valid, normalized_id = validate_paper_id("https://openalex.org/W1234567890")
        self.assertTrue(is_valid)
        self.assertEqual(normalized_id, "https://openalex.org/W1234567890")
    
    def test_validate_paper_id_invalid(self):
        """Test validating invalid paper ID."""
        is_valid, normalized_id = validate_paper_id("")
        self.assertFalse(is_valid)
        self.assertEqual(normalized_id, "")
        
        is_valid, normalized_id = validate_paper_id(None)
        self.assertFalse(is_valid)
        self.assertEqual(normalized_id, "")
    
    def test_validate_search_params_valid(self):
        """Test validating valid search parameters."""
        params = {
            'q': 'machine learning',
            'page': '1',
            'per_page': '25',
            'sort': 'cited_by_count'
        }
        
        is_valid, error_msg, cleaned_params = validate_search_params(params)
        self.assertTrue(is_valid)
        self.assertEqual(error_msg, "")
        self.assertEqual(cleaned_params['query'], 'machine learning')
        self.assertEqual(cleaned_params['page'], 1)
        self.assertEqual(cleaned_params['per_page'], 25)
        self.assertEqual(cleaned_params['sort_by'], 'cited_by_count')
    
    def test_validate_search_params_missing_query(self):
        """Test validating search parameters with missing query."""
        params = {
            'page': '1',
            'per_page': '25'
        }
        
        is_valid, error_msg, cleaned_params = validate_search_params(params)
        self.assertFalse(is_valid)
        self.assertIn("Query parameter 'q' is required", error_msg)
        self.assertEqual(cleaned_params, {})
    
    def test_validate_search_params_invalid_page(self):
        """Test validating search parameters with invalid page."""
        params = {
            'q': 'machine learning',
            'page': '0',
            'per_page': '25'
        }
        
        is_valid, error_msg, cleaned_params = validate_search_params(params)
        self.assertFalse(is_valid)
        self.assertIn("Page must be a positive integer", error_msg)
    
    def test_validate_search_params_invalid_per_page(self):
        """Test validating search parameters with invalid per_page."""
        params = {
            'q': 'machine learning',
            'page': '1',
            'per_page': '100'
        }
        
        is_valid, error_msg, cleaned_params = validate_search_params(params)
        self.assertFalse(is_valid)
        self.assertIn("Per page must be between 1 and 50", error_msg)
    
    def test_validate_search_params_invalid_sort(self):
        """Test validating search parameters with invalid sort."""
        params = {
            'q': 'machine learning',
            'page': '1',
            'per_page': '25',
            'sort': 'invalid_sort'
        }
        
        is_valid, error_msg, cleaned_params = validate_search_params(params)
        self.assertFalse(is_valid)
        self.assertIn("Sort must be one of", error_msg)
    
    def test_validate_graph_params_valid(self):
        """Test validating valid graph parameters."""
        params = {
            'iterations': '3',
            'cited_limit': '5',
            'ref_limit': '5'
        }
        
        is_valid, error_msg, cleaned_params = validate_graph_params(params)
        self.assertTrue(is_valid)
        self.assertEqual(error_msg, "")
        self.assertEqual(cleaned_params['iterations'], 3)
        self.assertEqual(cleaned_params['cited_limit'], 5)
        self.assertEqual(cleaned_params['ref_limit'], 5)
    
    def test_validate_graph_params_invalid_iterations(self):
        """Test validating graph parameters with invalid iterations."""
        params = {
            'iterations': '10',
            'cited_limit': '5',
            'ref_limit': '5'
        }
        
        is_valid, error_msg, cleaned_params = validate_graph_params(params)
        self.assertFalse(is_valid)
        self.assertIn("Iterations must be between 1 and 5", error_msg)
    
    def test_validate_graph_params_invalid_limits(self):
        """Test validating graph parameters with invalid limits."""
        params = {
            'iterations': '3',
            'cited_limit': '50',
            'ref_limit': '5'
        }
        
        is_valid, error_msg, cleaned_params = validate_graph_params(params)
        self.assertFalse(is_valid)
        self.assertIn("Cited limit must be between 1 and 20", error_msg)


class TestRateLimiter(unittest.TestCase):
    """Test cases for RateLimiter."""
    
    def test_rate_limiter_creation(self):
        """Test creating RateLimiter."""
        limiter = RateLimiter(delay=0.1, max_retries=3)
        self.assertEqual(limiter.delay, 0.1)
        self.assertEqual(limiter.max_retries, 3)
    
    def test_should_retry(self):
        """Test retry logic."""
        limiter = RateLimiter(max_retries=2)
        
        self.assertTrue(limiter.should_retry(0))
        self.assertTrue(limiter.should_retry(1))
        self.assertFalse(limiter.should_retry(2))
        self.assertFalse(limiter.should_retry(3))


if __name__ == '__main__':
    unittest.main()
