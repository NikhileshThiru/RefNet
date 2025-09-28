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
    const self = this;
    return {
      async findSimilarPapers(paperMetadata, count = 5, originalSearchQuery = '') {
        return await self.findSimilarPapers(paperMetadata, count, originalSearchQuery);
      },
      
      async analyzePaperContext(paperMetadata, graphContext) {
        return await self.analyzePaperContextViaAPI(paperMetadata, graphContext);
      }
    };
  }

  /**
   * Find similar papers using OpenAlex API keyword search
   */
  async findSimilarPapers(paperMetadata, count = 5, originalSearchQuery = '') {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🔍 [MAIN METHOD] Searching OpenAlex for papers similar to:', paperMetadata.title);
      console.log('🔍 [MAIN METHOD] Original search context:', originalSearchQuery);
      console.log('🔍 [MAIN METHOD] COUNT PARAMETER:', count, 'type:', typeof count);
      
      // Use original search query as primary context, fallback to paper keywords
      let searchTerms = [];
      
      if (originalSearchQuery && originalSearchQuery.trim()) {
        // Use original search query as the main search term
        searchTerms = [originalSearchQuery.trim()];
        console.log('🔍 Using original search query as primary context:', originalSearchQuery);
      } else {
        // Fallback to extracting keywords from the selected paper
        const titleKeywords = this.extractKeywords(paperMetadata.title || '');
        const abstractKeywords = this.extractKeywords(paperMetadata.abstract || '');
        const allKeywords = [...titleKeywords, ...abstractKeywords];
        
        // Get unique keywords and take the most relevant ones
        const uniqueKeywords = [...new Set(allKeywords)];
        searchTerms = uniqueKeywords.slice(0, 5); // Take top 5 keywords
        console.log('🔍 Using paper keywords as fallback:', searchTerms);
      }
      
      console.log('🔍 Final search terms:', searchTerms);
      
      // Search OpenAlex API
      const searchQuery = searchTerms.join(' OR ');
      console.log('🔍 Making OpenAlex API call with query:', searchQuery);
      console.log('🔍 API parameters:', { query: searchQuery, page: 1, limit: Math.max(count * 2, 10), sort: 'cited_by_count' });
      
      const searchResults = await searchAPI.searchPapers(
        searchQuery,
        1, // page
        Math.max(count * 2, 10), // limit - get more results to filter
        'cited_by_count' // sort by citations
      );

      console.log('🔍 OpenAlex API response:', searchResults);
      console.log('🔍 Number of papers returned:', searchResults.papers?.length || 0);
      console.log('🔍 First few paper titles:', searchResults.papers?.slice(0, 5).map(p => p.title) || []);

      if (!searchResults.papers || searchResults.papers.length === 0) {
        console.log('❌ No results from OpenAlex API');
        return [];
      }

      // Filter out the original paper if it's in the results
      const filteredPapers = searchResults.papers.filter(paper => 
        paper.id !== paperMetadata.id
      );

      // Take the top papers based on requested count
      console.log('🔍 Filtered papers count:', filteredPapers.length);
      console.log('🔍 Requested count:', count);
      console.log('🔍 Taking papers:', Math.min(filteredPapers.length, count));
      
      const similarPapers = filteredPapers.slice(0, count).map(paper => ({
        id: paper.id,
        title: paper.title,
        authors: paper.authors || [],
        year: paper.publication_year || new Date().getFullYear(),
        doi: paper.doi,
        abstract: paper.abstract,
        citations: paper.cited_by_count || 0,
        relevanceScore: 0.8, // Default relevance score
        source: 'openalex_api',
        aiGenerated: true,
        searchKeywords: searchTerms
      }));

      console.log('✅ Found', similarPapers.length, 'similar papers from OpenAlex');
      return similarPapers;
      
    } catch (error) {
      console.error('❌ Error searching OpenAlex for similar papers:', error);
      console.log('🔧 Attempting fallback search with paper keywords only...');
      
      // Fallback: try with just paper keywords if original search fails
      try {
        const titleKeywords = this.extractKeywords(paperMetadata.title || '');
        const abstractKeywords = this.extractKeywords(paperMetadata.abstract || '');
        const allKeywords = [...titleKeywords, ...abstractKeywords];
        const uniqueKeywords = [...new Set(allKeywords)];
        const fallbackTerms = uniqueKeywords.slice(0, 5);
        
        console.log('🔍 Fallback search with keywords:', fallbackTerms);
        
        const fallbackResults = await searchAPI.searchPapers(
          fallbackTerms.join(' OR '),
          1,
          Math.max(count * 2, 10),
          'cited_by_count'
        );
        
        if (fallbackResults.papers && fallbackResults.papers.length > 0) {
          const fallbackPapers = fallbackResults.papers.slice(0, count).map(paper => ({
            id: paper.id,
            title: paper.title,
            authors: paper.authors || [],
            year: paper.publication_year || new Date().getFullYear(),
            doi: paper.doi,
            abstract: paper.abstract,
            citations: paper.cited_by_count || 0,
            relevanceScore: 0.7,
            source: 'openalex_fallback',
            aiGenerated: false,
            searchKeywords: fallbackTerms
          }));
          
          console.log('✅ Fallback search found', fallbackPapers.length, 'papers');
          return fallbackPapers;
        }
      } catch (fallbackError) {
        console.error('❌ Fallback search also failed:', fallbackError);
      }
      
      return [];
    }
  }

  /**
   * Analyze paper content to extract research themes and concepts
   */
  analyzePaperContent(paper) {
    const { title, abstract, authors, year, topics } = paper;
    
    // Extract key research concepts from title and abstract
    const titleWords = this.extractResearchConcepts(title);
    const abstractWords = abstract ? this.extractResearchConcepts(abstract) : [];
    const allConcepts = [...titleWords, ...abstractWords];
    
    // Identify research methodology and domain
    const methodology = this.identifyMethodology(title, abstract);
    const researchDomain = this.identifyResearchDomain(title, abstract);
    const keyTerms = this.extractKeyTerms(allConcepts);
    
    return {
      title: title,
      authors: authors || [],
      year: year || new Date().getFullYear(),
      abstract: abstract || '',
      researchDomain: researchDomain,
      methodology: methodology,
      keyTerms: keyTerms,
      concepts: allConcepts,
      topics: topics || []
    };
  }

  /**
   * Extract research concepts from text
   */
  extractResearchConcepts(text) {
    if (!text) return [];
    
    // Split text into meaningful words, removing common words
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !this.isCommonWord(word) &&
        !this.isGenericAcademicWord(word)
      );
    
    // Get unique words and their frequency
    const wordCounts = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Return most frequent meaningful words
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Identify research methodology from title and abstract
   */
  identifyMethodology(title, abstract) {
    const text = `${title} ${abstract || ''}`.toLowerCase();
    
    const methodologies = {
      'machine learning': ['machine learning', 'ml', 'neural network', 'deep learning', 'ai', 'artificial intelligence'],
      'statistical': ['statistical', 'regression', 'analysis', 'correlation', 'hypothesis'],
      'experimental': ['experiment', 'trial', 'study', 'observation', 'empirical'],
      'theoretical': ['theory', 'theoretical', 'model', 'framework', 'conceptual'],
      'computational': ['algorithm', 'computation', 'simulation', 'computational', 'programming'],
      'qualitative': ['interview', 'survey', 'qualitative', 'case study', 'ethnography'],
      'quantitative': ['quantitative', 'measurement', 'metrics', 'data analysis']
    };
    
    for (const [method, keywords] of Object.entries(methodologies)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return method;
      }
    }
    
    return 'general';
  }

  /**
   * Identify research domain from title and abstract
   */
  identifyResearchDomain(title, abstract) {
    const text = `${title} ${abstract || ''}`.toLowerCase();
    
    const domains = {
      'computer science': ['computer', 'software', 'algorithm', 'programming', 'system', 'database'],
      'biology': ['biological', 'gene', 'protein', 'cell', 'organism', 'evolution'],
      'medicine': ['medical', 'clinical', 'patient', 'disease', 'treatment', 'health'],
      'physics': ['physical', 'quantum', 'energy', 'particle', 'force', 'matter'],
      'chemistry': ['chemical', 'molecule', 'reaction', 'compound', 'synthesis'],
      'psychology': ['psychological', 'behavior', 'cognitive', 'mental', 'brain'],
      'economics': ['economic', 'financial', 'market', 'trade', 'business'],
      'social science': ['social', 'society', 'human', 'culture', 'community']
    };
    
    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return domain;
      }
    }
    
    return 'general';
  }

  /**
   * Extract key terms that represent the core research focus
   */
  extractKeyTerms(concepts) {
    // Filter out very common academic terms and focus on specific research terms
    const filteredConcepts = concepts.filter(concept => 
      !this.isGenericAcademicWord(concept) && 
      concept.length > 4
    );
    
    return filteredConcepts.slice(0, 5);
  }

  /**
   * Check if word is a generic academic term
   */
  isGenericAcademicWord(word) {
    const genericWords = [
      'research', 'study', 'analysis', 'approach', 'method', 'result', 'conclusion',
      'paper', 'article', 'publication', 'journal', 'conference', 'proceedings',
      'data', 'information', 'knowledge', 'understanding', 'development', 'application',
      'system', 'model', 'framework', 'technique', 'algorithm', 'process', 'design'
    ];
    return genericWords.includes(word);
  }

  /**
   * Build AI prompt for finding similar papers based on real content analysis
   */
  buildSimilarPapersPrompt(analyzedPaper) {
    const { title, authors, year, researchDomain, methodology, keyTerms, abstract } = analyzedPaper;
    
    return `
Find 5-8 research papers similar to: "${title}" by ${authors.join(', ')} (${year}).

Research Domain: ${researchDomain}
Methodology: ${methodology}
Key Research Terms: ${keyTerms.join(', ')}
Abstract: ${abstract.substring(0, 300)}...

Search Criteria:
1. Papers in the same research domain (${researchDomain})
2. Using similar methodology (${methodology})
3. Related to these key concepts: ${keyTerms.join(', ')}
4. Published within 10 years (${year - 10} to ${year + 5})
5. High citation count or recent influential work

Focus on papers that:
- Share similar research questions or problems
- Use comparable methods or approaches
- Build upon or extend similar theoretical frameworks
- Address related practical applications

Return format: JSON array with papers containing: id, title, authors, year, doi, abstract, relevanceScore, citations
`;
  }

  /**
   * Find papers that connect or bridge multiple research papers using OpenAlex API
   */
  async findBridgingPapers(papers, count = 5, originalSearchQuery = '') {
    if (papers.length < 2) {
      return await this.findSimilarPapers(papers[0], count, originalSearchQuery);
    }

    try {
      console.log('🔗 Searching OpenAlex for bridging papers connecting', papers.length, 'selected papers...');
      console.log('🔍 Original search context:', originalSearchQuery);
      
      // Use original search query as primary context, fallback to paper keywords
      let searchTerms = [];
      
      if (originalSearchQuery && originalSearchQuery.trim()) {
        // Use original search query as the main search term
        searchTerms = [originalSearchQuery.trim()];
        console.log('🔍 Using original search query as primary context:', originalSearchQuery);
      } else {
        // Fallback to extracting keywords from all selected papers
        const allKeywords = [];
        papers.forEach(paper => {
          // Extract keywords from title and abstract
          const titleWords = this.extractKeywords(paper.title || '');
          const abstractWords = this.extractKeywords(paper.abstract || '');
          allKeywords.push(...titleWords, ...abstractWords);
        });
        
        // Get unique keywords and take the most relevant ones
        const uniqueKeywords = [...new Set(allKeywords)];
        searchTerms = uniqueKeywords.slice(0, 5); // Take top 5 keywords
        console.log('🔍 Using paper keywords as fallback:', searchTerms);
      }
      
      console.log('🔍 Final search terms:', searchTerms);
      
      // Search OpenAlex API with combined keywords
      const searchQuery = searchTerms.join(' OR ');
      const searchResults = await searchAPI.searchPapers(
        searchQuery,
        1, // page
        Math.max(count * 2, 15), // limit - get more results to filter
        'cited_by_count' // sort by citations
      );

      if (!searchResults.papers || searchResults.papers.length === 0) {
        console.log('❌ No results from OpenAlex API');
        return [];
      }

      // Filter out papers that are already in the graph
      const existingPaperIds = new Set(papers.map(p => p.id));
      const filteredPapers = searchResults.papers.filter(paper => 
        !existingPaperIds.has(paper.id)
      );

      // Take the top papers based on requested count
      const bridgingPapers = filteredPapers.slice(0, count).map(paper => ({
        id: paper.id,
        title: paper.title,
        authors: paper.authors || [],
        year: paper.publication_year || new Date().getFullYear(),
        doi: paper.doi,
        abstract: paper.abstract,
        citations: paper.cited_by_count || 0,
        relevanceScore: 0.8, // Default relevance score
        source: 'openalex_api',
        aiGenerated: true,
        bridgingPaper: true,
        searchKeywords: topKeywords
      }));

      console.log('✅ Found', bridgingPapers.length, 'bridging papers from OpenAlex');
      return bridgingPapers;
      
    } catch (error) {
      console.error('❌ Error searching OpenAlex for bridging papers:', error);
      console.log('🔧 Attempting fallback search with paper keywords only...');
      
      // Fallback: try with just paper keywords if original search fails
      try {
        const allKeywords = [];
        papers.forEach(paper => {
          const titleWords = this.extractKeywords(paper.title || '');
          const abstractWords = this.extractKeywords(paper.abstract || '');
          allKeywords.push(...titleWords, ...abstractWords);
        });
        
        const uniqueKeywords = [...new Set(allKeywords)];
        const fallbackTerms = uniqueKeywords.slice(0, 5);
        
        console.log('🔍 Fallback search with keywords:', fallbackTerms);
        
        const fallbackResults = await searchAPI.searchPapers(
          fallbackTerms.join(' OR '),
          1,
          Math.max(count * 2, 15),
          'cited_by_count'
        );
        
        if (fallbackResults.papers && fallbackResults.papers.length > 0) {
          const existingPaperIds = new Set(papers.map(p => p.id));
          const filteredPapers = fallbackResults.papers.filter(paper => 
            !existingPaperIds.has(paper.id)
          );
          
          const fallbackPapers = filteredPapers.slice(0, count).map(paper => ({
            id: paper.id,
            title: paper.title,
            authors: paper.authors || [],
            year: paper.publication_year || new Date().getFullYear(),
            doi: paper.doi,
            abstract: paper.abstract,
            citations: paper.cited_by_count || 0,
            relevanceScore: 0.7,
            source: 'openalex_fallback',
            aiGenerated: false,
            searchKeywords: fallbackTerms
          }));
          
          console.log('✅ Fallback search found', fallbackPapers.length, 'bridging papers');
          return fallbackPapers;
        }
      } catch (fallbackError) {
        console.error('❌ Fallback search also failed:', fallbackError);
      }
      
      return [];
    }
  }

  /**
   * Extract meaningful keywords from text
   */
  extractKeywords(text) {
    if (!text) return [];
    
    // Split text into words, remove punctuation and common words
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !this.isCommonWord(word) &&
        !this.isGenericAcademicWord(word)
      );
    
    // Get unique words and their frequency
    const wordCounts = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Return most frequent meaningful words
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Find common research domains across multiple papers
   */
  findCommonResearchDomains(analyzedPapers) {
    const domainCounts = {};
    
    analyzedPapers.forEach(paper => {
      const domain = paper.researchDomain;
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });
    
    // Return domains that appear in at least 2 papers
    return Object.entries(domainCounts)
      .filter(([domain, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([domain]) => domain);
  }

  /**
   * Find common methodologies across multiple papers
   */
  findCommonMethodologies(analyzedPapers) {
    const methodologyCounts = {};
    
    analyzedPapers.forEach(paper => {
      const methodology = paper.methodology;
      methodologyCounts[methodology] = (methodologyCounts[methodology] || 0) + 1;
    });
    
    // Return methodologies that appear in at least 2 papers
    return Object.entries(methodologyCounts)
      .filter(([method, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([method]) => method);
  }

  /**
   * Find common concepts across multiple papers
   */
  findCommonConcepts(analyzedPapers) {
    const conceptCounts = {};
    
    analyzedPapers.forEach(paper => {
      paper.concepts.forEach(concept => {
        conceptCounts[concept] = (conceptCounts[concept] || 0) + 1;
      });
    });
    
    // Return concepts that appear in at least 2 papers
    return Object.entries(conceptCounts)
      .filter(([concept, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([concept]) => concept);
  }

  /**
   * Find bridging terms that connect different papers
   */
  findBridgingTerms(analyzedPapers) {
    const allConcepts = analyzedPapers.flatMap(paper => paper.concepts);
    const uniqueConcepts = [...new Set(allConcepts)];
    
    // Find concepts that appear in multiple papers but not all
    const bridgingConcepts = uniqueConcepts.filter(concept => {
      const papersWithConcept = analyzedPapers.filter(paper => 
        paper.concepts.includes(concept)
      ).length;
      
      // Bridge if concept appears in 2+ papers but not all papers
      return papersWithConcept >= 2 && papersWithConcept < analyzedPapers.length;
    });
    
    return bridgingConcepts.slice(0, 8);
  }

  /**
   * Generate intelligent mock bridging papers based on content analysis
   */
  generateIntelligentBridgingPapers(analyzedPapers, count = 5) {
    const mockPapers = [];
    const commonDomains = this.findCommonResearchDomains(analyzedPapers);
    const commonMethodologies = this.findCommonMethodologies(analyzedPapers);
    const bridgingTerms = this.findBridgingTerms(analyzedPapers);
    
    // Create more realistic bridging paper titles based on analysis
    const bridgingTitles = [
      `Interdisciplinary ${commonDomains[0] || 'Research'}: Bridging ${bridgingTerms.slice(0, 2).join(' and ')}`,
      `Cross-Domain Analysis of ${bridgingTerms[0] || 'Research Concepts'} in ${commonDomains[0] || 'Multiple Fields'}`,
      `Connecting ${commonMethodologies[0] || 'Research Methods'}: A ${bridgingTerms[0] || 'Unified'} Perspective`,
      `Synthesis of ${analyzedPapers.length} Research Areas: ${bridgingTerms.slice(0, 3).join(', ')}`,
      `Bridging ${commonDomains[0] || 'Research'} and ${commonDomains[1] || 'Related Fields'}: ${bridgingTerms[0] || 'New Insights'}`
    ];
    
    const bridgingAuthors = [
      ['Synthesis', 'Research'],
      ['Cross', 'Domain'],
      ['Interdisciplinary', 'Analysis'],
      ['Bridging', 'Studies'],
      ['Unified', 'Research']
    ];
    
    for (let i = 0; i < count; i++) {
      const avgYear = Math.round(analyzedPapers.reduce((sum, p) => sum + p.year, 0) / analyzedPapers.length);
      
      mockPapers.push({
        id: `intelligent_bridge_${Date.now()}_${i}`,
        title: bridgingTitles[i] || `Intelligent Bridging Paper ${i + 1}`,
        authors: bridgingAuthors[i] || ['Intelligent Bridge Author'],
        year: avgYear + Math.floor(Math.random() * 3) - 1,
        doi: `10.1000/intelligent.${Date.now()}.${i}`,
        abstract: `This intelligent bridging paper connects research areas involving ${bridgingTerms.slice(0, 3).join(', ')}. It synthesizes methodologies from ${commonMethodologies.join(', ')} and bridges domains in ${commonDomains.join(', ')}.`,
        citations: Math.floor(Math.random() * 200) + 50,
        relevanceScore: 0.95 - (i * 0.1),
        source: 'intelligent_mock',
        aiGenerated: true,
        bridgingPaper: true,
        bridgingAnalysis: {
          connectsDomains: commonDomains,
          sharedMethodology: commonMethodologies,
          bridgingConcepts: bridgingTerms
        }
      });
    }
    
    console.log('🔧 Generated', mockPapers.length, 'intelligent bridging papers');
    return mockPapers;
  }

  /**
   * Extract search terms from multiple papers for better bridging
   */
  extractSearchTermsFromMultiple(papers) {
    const allTerms = [];
    
    papers.forEach(paper => {
      const terms = this.extractSearchTerms(paper.title, paper.authors);
      allTerms.push(...terms);
    });
    
    // Get most common terms across all papers
    const termCounts = {};
    allTerms.forEach(term => {
      termCounts[term] = (termCounts[term] || 0) + 1;
    });
    
    // Return terms that appear in multiple papers (more likely to be bridging)
    return Object.entries(termCounts)
      .filter(([term, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([term]) => term);
  }

  /**
   * Calculate relevance score for bridging papers
   */
  calculateBridgingRelevanceScore(originalPapers, candidatePaper, commonTopics, commonAuthors) {
    let score = 0;
    
    // Topic overlap with common themes
    if (candidatePaper.topics && commonTopics.length > 0) {
      const topicOverlap = this.calculateTopicOverlap(commonTopics, candidatePaper.topics);
      score += topicOverlap * 0.4;
    }
    
    // Author connections
    if (candidatePaper.authors && commonAuthors.length > 0) {
      const authorOverlap = this.calculateAuthorOverlap(commonAuthors, candidatePaper.authors);
      score += authorOverlap * 0.3;
    }
    
    // Year proximity to average year
    const avgYear = Math.round(originalPapers.reduce((sum, p) => sum + (p.year || 0), 0) / originalPapers.length);
    if (candidatePaper.year && avgYear) {
      const yearDiff = Math.abs(candidatePaper.year - avgYear);
      const yearScore = Math.max(0, 1 - (yearDiff / 15)); // 15 year window for bridging
      score += yearScore * 0.3;
    }
    
    return Math.min(1, score);
  }

  /**
   * Calculate topic overlap between two sets of topics
   */
  calculateTopicOverlap(topics1, topics2) {
    if (!topics1 || !topics2 || topics1.length === 0 || topics2.length === 0) {
      return 0;
    }
    
    const set1 = new Set(topics1.map(t => t.toLowerCase()));
    const set2 = new Set(topics2.map(t => t.toLowerCase()));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Fallback method using existing API for finding similar papers
   */
  async findSimilarPapersViaAPI(paperMetadata, count = 5) {
    try {
      console.log('🔍 [FALLBACK METHOD] findSimilarPapersViaAPI called');
      const { title, authors } = paperMetadata;
      
      // Extract key terms from title and authors for search
      const searchTerms = this.extractSearchTerms(title, authors);
      
      // Search for papers with similar terms
      const searchResults = await searchAPI.searchPapers(
        searchTerms.join(' OR '), 
        1, 
        Math.max(count * 2, 10), 
        'cited_by_count'
      );

      // Process results to match expected format
      const processedPapers = searchResults.papers?.map(paper => ({
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
      
      // If no results from API, generate mock papers for testing
      if (processedPapers.length === 0) {
        console.log('🔧 No API results, generating mock papers for testing');
        return this.generateMockPapers(paperMetadata, count);
      }
      
      return processedPapers;
      
    } catch (error) {
      console.error('Error in API fallback search:', error);
      console.log('🔧 API error, generating mock papers for testing');
      return this.generateMockPapers(paperMetadata, count);
    }
  }

  /**
   * Generate intelligent mock papers based on content analysis
   */
  generateMockPapers(paperMetadata, count = 5) {
    const mockPapers = [];
    
    // Analyze the paper content to generate more relevant mock papers
    const analyzedPaper = this.analyzePaperContent(paperMetadata);
    const { title, researchDomain, methodology, keyTerms, authors } = analyzedPaper;
    
    // Generate more realistic titles based on content analysis
    const mockTitles = [
      `Advanced ${methodology} Approaches in ${researchDomain}`,
      `Recent Advances in ${keyTerms[0] || 'Research Methods'}: ${researchDomain} Perspective`,
      `Comparative Analysis of ${keyTerms.slice(0, 2).join(' and ')} in ${researchDomain}`,
      `Novel ${methodology} Framework for ${keyTerms[0] || 'Research Applications'}`,
      `Emerging Trends in ${researchDomain}: ${keyTerms.slice(0, 2).join(', ')} Applications`
    ];
    
    const mockAuthors = [
      ['Advanced', 'Research'],
      ['Novel', 'Methods'],
      ['Comparative', 'Analysis'],
      ['Emerging', 'Trends'],
      ['Innovative', 'Approach']
    ];
    
    for (let i = 0; i < count; i++) {
      mockPapers.push({
        id: `intelligent_mock_${Date.now()}_${i}`,
        title: mockTitles[i] || `Intelligent Related Paper ${i + 1}`,
        authors: mockAuthors[i] || ['Intelligent Author'],
        year: analyzedPaper.year + Math.floor(Math.random() * 3) - 1,
        doi: `10.1000/intelligent.${Date.now()}.${i}`,
        abstract: `This intelligent mock paper explores ${keyTerms.slice(0, 2).join(' and ')} in the context of ${researchDomain}. It builds upon ${methodology} approaches and addresses similar research questions to "${title}".`,
        citations: Math.floor(Math.random() * 150) + 25,
        relevanceScore: 0.9 - (i * 0.1),
        source: 'intelligent_mock',
        aiGenerated: true,
        contentAnalysis: {
          researchDomain: researchDomain,
          methodology: methodology,
          keyTerms: keyTerms.slice(0, 3)
        }
      });
    }
    
    console.log('🔧 Generated', mockPapers.length, 'intelligent mock papers based on content analysis');
    return mockPapers;
  }

  /**
   * Generate mock bridging papers for testing when API is not available
   */
  generateMockBridgingPapers(papers) {
    const mockPapers = [];
    const paperTitles = papers.map(p => p.title || 'Research Paper');
    const combinedTitle = paperTitles.join(', ');
    
    const bridgingTitles = [
      `Bridging Research: Connecting ${paperTitles.length} Research Areas`,
      `Cross-Domain Analysis: ${paperTitles[0]} and Related Fields`,
      `Interdisciplinary Study: ${combinedTitle.substring(0, 50)}...`,
      `Research Synthesis: ${paperTitles.length} Papers Analysis`,
      `Connecting the Dots: ${paperTitles[0]} and Beyond`
    ];
    
    const bridgingAuthors = [
      ['Connector', 'Bridge'],
      ['Synthesis', 'Analysis'],
      ['Cross', 'Domain'],
      ['Interdisciplinary', 'Research'],
      ['Network', 'Analysis']
    ];
    
    for (let i = 0; i < 5; i++) {
      mockPapers.push({
        id: `bridge_mock_${Date.now()}_${i}`,
        title: bridgingTitles[i] || `Bridging Paper ${i + 1}`,
        authors: bridgingAuthors[i] || ['Bridge Author'],
        year: Math.round(papers.reduce((sum, p) => sum + (p.year || 0), 0) / papers.length) + Math.floor(Math.random() * 3) - 1,
        doi: `10.1000/bridge.${Date.now()}.${i}`,
        abstract: `This paper bridges connections between ${paperTitles.length} research areas: ${combinedTitle.substring(0, 100)}...`,
        citations: Math.floor(Math.random() * 150) + 20,
        relevanceScore: 0.9 - (i * 0.15),
        source: 'mock_bridging',
        aiGenerated: true,
        bridgingPaper: true
      });
    }
    
    console.log('🔧 Generated', mockPapers.length, 'mock bridging papers');
    return mockPapers;
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
