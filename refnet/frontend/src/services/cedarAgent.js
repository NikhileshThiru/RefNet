import { graphAPI, searchAPI } from './api.js';

/**
 * Cedar Agent Service for Academic Paper Analysis
 * Provides AI-powered paper discovery and analysis capabilities
 */
export class CedarAgent {
  constructor() {
    this.isInitialized = false;
    this.apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  }

  /**
   * Initialize the Cedar agent
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Initialize Cedar agent with academic focus
      this.agent = await this.createAcademicAgent();
      this.isInitialized = true;
      console.log('Cedar Agent initialized for academic paper analysis');
    } catch (error) {
      console.error('Failed to initialize Cedar Agent:', error);
      throw error;
    }
  }

  /**
   * Create an academic-focused Cedar agent
   */
  async createAcademicAgent() {
    // For now, we'll create a simple agent that uses the existing APIs
    // In a full implementation, this would integrate with Cedar's AI capabilities
    return {
      async findSimilarPapers(paperMetadata) {
        return await this.findSimilarPapersViaAPI(paperMetadata);
      },
      
      async analyzePaperContext(paperMetadata, graphContext) {
        return await this.analyzePaperContextViaAPI(paperMetadata, graphContext);
      }
    };
  }

  /**
   * Find similar papers using AI analysis
   */
  async findSimilarPapers(paperMetadata) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const { title, authors, abstract, year } = paperMetadata;
      
      // Create AI prompt for finding similar papers
      const prompt = this.buildSimilarPapersPrompt(paperMetadata);
      
      // Use the agent to find similar papers
      const suggestions = await this.agent.findSimilarPapers(paperMetadata);
      
      return suggestions.map(paper => ({
        ...paper,
        source: 'ai_discovery',
        relevanceScore: paper.relevanceScore || 0.8,
        aiGenerated: true
      }));
      
    } catch (error) {
      console.error('Error finding similar papers:', error);
      // Fallback to API-based search
      return await this.findSimilarPapersViaAPI(paperMetadata);
    }
  }

  /**
   * Build AI prompt for finding similar papers
   */
  buildSimilarPapersPrompt(paperMetadata) {
    const { title, authors, abstract, year } = paperMetadata;
    
    return `
Find 5-8 similar research papers to: "${title}" by ${authors.join(', ')} (${year}).

Paper Abstract: ${abstract || 'No abstract available'}

Requirements:
1. Papers should be from similar research areas or methodologies
2. Include papers that cite or are cited by similar work
3. Prioritize recent papers (last 5 years) but include seminal works
4. Return structured data with DOI, title, authors, year, relevance score
5. Focus on papers that would add value to a citation network

Return format: JSON array with papers containing: id, title, authors, year, doi, abstract, relevanceScore, citations
`;
  }

  /**
   * Fallback method using existing API for finding similar papers
   */
  async findSimilarPapersViaAPI(paperMetadata) {
    try {
      const { title, authors } = paperMetadata;
      
      // Extract key terms from title and authors for search
      const searchTerms = this.extractSearchTerms(title, authors);
      
      // Search for papers with similar terms
      const searchResults = await searchAPI.searchPapers(
        searchTerms.join(' OR '), 
        1, 
        8, 
        'cited_by_count'
      );

      // Process results to match expected format
      return searchResults.papers?.map(paper => ({
        id: paper.id,
        title: paper.title,
        authors: paper.authors || [],
        year: paper.publication_year || new Date().getFullYear(),
        doi: paper.doi,
        abstract: paper.abstract,
        citations: paper.cited_by_count || 0,
        relevanceScore: this.calculateRelevanceScore(paperMetadata, paper),
        source: 'api_fallback',
        aiGenerated: false
      })) || [];
      
    } catch (error) {
      console.error('Error in API fallback search:', error);
      return [];
    }
  }

  /**
   * Extract search terms from title and authors
   */
  extractSearchTerms(title, authors) {
    const terms = [];
    
    // Extract key terms from title (remove common words)
    const titleWords = title.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !this.isCommonWord(word));
    
    terms.push(...titleWords.slice(0, 3)); // Take top 3 meaningful words
    
    // Add author names for search
    if (authors && authors.length > 0) {
      terms.push(authors[0]); // Add first author
    }
    
    return terms;
  }

  /**
   * Check if a word is common (to filter out from search terms)
   */
  isCommonWord(word) {
    const commonWords = ['the', 'and', 'for', 'are', 'with', 'this', 'that', 'from', 'they', 'have', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'will', 'about', 'there', 'could', 'other', 'more', 'very', 'what', 'know', 'just', 'first', 'also', 'after', 'back', 'well', 'work', 'life', 'only', 'still', 'over', 'even', 'before', 'years', 'much', 'good', 'through', 'most', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were'];
    return commonWords.includes(word);
  }

  /**
   * Calculate relevance score between two papers
   */
  calculateRelevanceScore(originalPaper, candidatePaper) {
    let score = 0;
    
    // Title similarity
    const titleSimilarity = this.calculateStringSimilarity(
      originalPaper.title.toLowerCase(),
      candidatePaper.title.toLowerCase()
    );
    score += titleSimilarity * 0.4;
    
    // Author overlap
    if (originalPaper.authors && candidatePaper.authors) {
      const authorOverlap = this.calculateAuthorOverlap(
        originalPaper.authors,
        candidatePaper.authors
      );
      score += authorOverlap * 0.3;
    }
    
    // Year proximity (closer years get higher scores)
    if (originalPaper.year && candidatePaper.year) {
      const yearDiff = Math.abs(originalPaper.year - candidatePaper.year);
      const yearScore = Math.max(0, 1 - (yearDiff / 20)); // 20 year window
      score += yearScore * 0.3;
    }
    
    return Math.min(1, score);
  }

  /**
   * Calculate string similarity using simple Jaccard similarity
   */
  calculateStringSimilarity(str1, str2) {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate author overlap between two papers
   */
  calculateAuthorOverlap(authors1, authors2) {
    if (!authors1 || !authors2 || authors1.length === 0 || authors2.length === 0) {
      return 0;
    }
    
    const set1 = new Set(authors1.map(a => a.toLowerCase()));
    const set2 = new Set(authors2.map(a => a.toLowerCase()));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Analyze paper context within the graph
   */
  async analyzePaperContext(paperMetadata, graphContext) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const analysis = {
        centrality: this.calculateCentrality(paperMetadata, graphContext),
        connections: this.findConnections(paperMetadata, graphContext),
        suggestions: await this.findSimilarPapers(paperMetadata),
        insights: this.generateInsights(paperMetadata, graphContext)
      };
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing paper context:', error);
      return {
        centrality: 0,
        connections: [],
        suggestions: [],
        insights: []
      };
    }
  }

  /**
   * Calculate paper centrality in the graph
   */
  calculateCentrality(paper, graphContext) {
    // Simple centrality calculation based on citations and references
    const citations = paper.citations || 0;
    const references = graphContext.nodes?.filter(n => 
      n.references?.includes(paper.id)
    ).length || 0;
    
    return Math.min(1, (citations + references) / 100);
  }

  /**
   * Find connections to other papers in the graph
   */
  findConnections(paper, graphContext) {
    const connections = [];
    
    // Find papers that reference this one
    const citingPapers = graphContext.nodes?.filter(n => 
      n.references?.includes(paper.id)
    ) || [];
    
    // Find papers that this one references
    const referencedPapers = graphContext.nodes?.filter(n => 
      paper.references?.includes(n.id)
    ) || [];
    
    connections.push(...citingPapers.map(p => ({ type: 'cites', paper: p })));
    connections.push(...referencedPapers.map(p => ({ type: 'cited_by', paper: p })));
    
    return connections;
  }

  /**
   * Generate insights about the paper
   */
  generateInsights(paper, graphContext) {
    const insights = [];
    
    if (paper.citations > 50) {
      insights.push('Highly cited paper - significant impact in the field');
    }
    
    if (paper.year && paper.year > new Date().getFullYear() - 2) {
      insights.push('Recent publication - cutting-edge research');
    }
    
    const connections = this.findConnections(paper, graphContext);
    if (connections.length > 10) {
      insights.push('Well-connected in the citation network');
    }
    
    return insights;
  }
}

// Export singleton instance
export const cedarAgent = new CedarAgent();
