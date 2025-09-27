# RefNet - Refactored Structure

A research paper citation network analysis tool with a clean, modular architecture.

## Project Structure

```
RefNet/
├── refnet/                          # Main package
│   ├── __init__.py                  # Package initialization
│   ├── models/                      # Data models
│   │   ├── __init__.py
│   │   ├── paper.py                 # Paper model and formatter
│   │   └── graph.py                 # Graph models and metadata
│   ├── services/                    # Business logic services
│   │   ├── __init__.py
│   │   ├── openalex_service.py      # OpenAlex API service
│   │   └── graph_service.py         # Graph building service
│   ├── api/                         # API routes
│   │   ├── __init__.py
│   │   ├── search_routes.py         # Search endpoints
│   │   ├── paper_routes.py          # Paper detail endpoints
│   │   └── graph_routes.py          # Graph endpoints
│   ├── utils/                       # Utility functions
│   │   ├── __init__.py
│   │   ├── validators.py            # Input validation
│   │   └── rate_limiter.py          # API rate limiting
│   └── tests/                       # Test suite
│       ├── __init__.py
│       ├── test_models.py           # Model tests
│       └── test_utils.py            # Utility tests
├── app.py                           # Main Flask application
├── config.py                        # Configuration management
├── requirements.txt                 # Dependencies
└── README_REFACTORED.md            # This file
```

## Key Improvements

### 1. **Modular Architecture**
- **Models**: Clean data structures with proper typing
- **Services**: Business logic separated from API concerns
- **API Routes**: Organized by functionality using Flask blueprints
- **Utils**: Reusable utility functions

### 2. **Better Code Organization**
- **Single Responsibility**: Each module has a clear purpose
- **Separation of Concerns**: API, business logic, and data models are separated
- **Type Hints**: Full type annotations for better code clarity
- **Error Handling**: Consistent error handling across all modules

### 3. **Enhanced Features**
- **Configuration Management**: Environment-based configuration
- **Input Validation**: Comprehensive parameter validation
- **Rate Limiting**: Built-in API rate limiting
- **Caching**: Paper data caching for better performance
- **Testing**: Unit tests for core functionality

### 4. **API Improvements**
- **RESTful Design**: Clean, consistent API endpoints
- **Better Error Messages**: Detailed error responses
- **Request Validation**: Input validation with clear error messages
- **Documentation**: Built-in API documentation

## Installation

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Set Environment Variables** (optional):
   ```bash
   export FLASK_ENV=development
   export FLASK_PORT=8000
   export API_RATE_LIMIT_DELAY=0.2
   ```

3. **Run the Application**:
   ```bash
   python app.py
   ```

## API Endpoints

### Search
- `GET /api/search` - Search for papers
- `GET /api/paper/<paper_id>` - Get paper details
- `GET /api/paper/<paper_id>/citations` - Get paper citations
- `GET /api/paper/<paper_id>/references` - Get paper references

### Graph
- `GET /api/graph/<paper_id>` - Build citation graph
- `POST /api/graph/multiple` - Build graph from multiple papers
- `GET /api/graph/<paper_id>/neighbors` - Get paper neighbors
- `GET /api/graph/stats` - Get graph statistics
- `GET /api/graph/data` - Get current graph data
- `POST /api/graph/clear` - Clear current graph

### Utility
- `GET /health` - Health check
- `GET /` - API documentation

## Configuration

The application supports different configurations:

- **Development**: `FLASK_ENV=development` (default)
- **Production**: `FLASK_ENV=production`
- **Testing**: `FLASK_ENV=testing`

Configuration options are defined in `config.py` and can be overridden with environment variables.

## Testing

Run the test suite:

```bash
python -m pytest refnet/tests/
```

Or run specific test files:

```bash
python refnet/tests/test_models.py
python refnet/tests/test_utils.py
```

## Usage Examples

### Search for Papers
```bash
curl "http://localhost:8000/api/search?q=machine+learning&page=1&per_page=10&sort=cited_by_count"
```

### Get Paper Details
```bash
curl "http://localhost:8000/api/paper/W2755950973"
```

### Build Citation Graph
```bash
curl "http://localhost:8000/api/graph/W2755950973?iterations=3&cited_limit=5&ref_limit=5"
```

### Build Graph from Multiple Papers
```bash
curl -X POST "http://localhost:8000/api/graph/multiple" \
  -H "Content-Type: application/json" \
  -d '{
    "root_paper_ids": ["W2755950973", "W1234567890"],
    "iterations": 3,
    "cited_limit": 5,
    "ref_limit": 5
  }'
```

## Benefits of Refactored Structure

1. **Maintainability**: Code is organized into logical modules
2. **Testability**: Each component can be tested independently
3. **Scalability**: Easy to add new features or modify existing ones
4. **Reusability**: Services and utilities can be reused across different parts
5. **Type Safety**: Full type hints help catch errors early
6. **Documentation**: Clear structure makes the code self-documenting
7. **Error Handling**: Consistent error handling throughout the application
8. **Configuration**: Environment-based configuration for different deployments

## Migration from Old Structure

The refactored structure maintains backward compatibility with the original API endpoints. The main changes are:

1. **Code Organization**: Split into logical modules
2. **Type Safety**: Added comprehensive type hints
3. **Error Handling**: Improved error handling and validation
4. **Testing**: Added unit tests
5. **Configuration**: Added configuration management
6. **Documentation**: Improved API documentation

The original functionality remains the same, but the code is now more maintainable, testable, and scalable.
