import networkx as nx
import json
from typing import Dict, List, Set, Tuple, Optional
from datetime import datetime
from pyalex import Works
import random
import math
import time

class PaperGraph:
    "This makes a graph of papers and how they cite each other."

    def __init__(self):
        "This sets up the graph and some simple caches."
        self.graph = nx.DiGraph()
        self.added_papers: Set[str] = set()
        self.paper_data_cache: Dict[str, Dict] = {}
        self.last_api_call = 0
        self.api_delay = 0.2
        self.max_retries = 1  # keep it simple: try once

    def normalize_paper_id(self, paper_id: str) -> str:
        "This turns IDs into a standard OpenAlex format."
        if paper_id.startswith('10.'):
            return f"https://doi.org/{paper_id}"
        elif not paper_id.startswith('https://openalex.org/'):
            return f"https://openalex.org/{paper_id}"
        return paper_id

    def _rate_limit_delay(self):
        "This waits a tiny bit so we don’t spam the API."
        now = time.time()
        gap = now - self.last_api_call
        if gap < self.api_delay:
            time.sleep(self.api_delay - gap)
        self.last_api_call = time.time()

    def get_paper_data(self, paper_id: str) -> Optional[Dict]:
        "This grabs paper data once and caches it."
        normalized_id = self.normalize_paper_id(paper_id)
        if normalized_id in self.paper_data_cache:
            return self.paper_data_cache[normalized_id]
        try:
            self._rate_limit_delay()
            paper = Works()[normalized_id]
            if paper:
                self.paper_data_cache[normalized_id] = paper
                return paper
            return None
        except Exception:
            # critical: just fail fast so the build can keep going
            return None

    def format_paper_for_node(self, paper: Dict) -> Optional[Dict]:
        "This picks the useful fields from the paper for drawing."
        if not paper or not isinstance(paper, dict):
            return None
        try:
            pub_year = paper.get('publication_year')
            authors = []
            if isinstance(paper.get('authorships'), list):
                for a in paper['authorships']:
                    if isinstance(a, dict):
                        author = a.get('author', {})
                        if isinstance(author, dict):
                            authors.append(author.get('display_name', 'Unknown Author'))

            abstract_text = ""
            if isinstance(paper.get('abstract'), str):
                abstract_text = paper['abstract'][:500] + "..." if len(paper['abstract']) > 500 else paper['abstract']

            topics = []
            if isinstance(paper.get('concepts'), list):
                for c in paper['concepts'][:5]:
                    if isinstance(c, dict):
                        topics.append(c.get('display_name', ''))

            doi = None
            if isinstance(paper.get('doi'), str):
                doi = paper['doi'].replace('https://doi.org/', '')

            citations = paper.get('cited_by_count', 0) if isinstance(paper.get('cited_by_count', 0), (int, float)) else 0

            venue = None
            pl = paper.get('primary_location', {})
            if isinstance(pl, dict):
                src = pl.get('source', {})
                if isinstance(src, dict):
                    venue = src.get('display_name', 'Unknown Venue')

            pub_type = paper.get('type', 'Unknown')
            language = paper.get('language', 'Unknown')

            oa = paper.get('open_access', {}) if isinstance(paper.get('open_access'), dict) else {}
            is_oa = oa.get('is_oa', False) if isinstance(oa, dict) else False
            oa_url = oa.get('oa_url', None) if isinstance(oa, dict) else None

            return {
                'id': paper.get('id', ''),
                'title': paper.get('title', 'Untitled'),
                'authors': authors,
                'year': pub_year,
                'abstract': abstract_text,
                'doi': doi,
                'citations': citations,
                'venue': venue,
                'topics': topics,
                'type': pub_type,
                'language': language,
                'is_open_access': is_oa,
                'openalex_url': paper.get('id', ''),
                'pdf_url': oa_url,
                'publication_date': paper.get('publication_date'),
                'referenced_works_count': len(paper.get('referenced_works', [])) if isinstance(paper.get('referenced_works'), list) else 0,
                'related_works_count': len(paper.get('related_works', [])) if isinstance(paper.get('related_works'), list) else 0
            }
        except Exception:
            # critical: if formatting fails, skip this paper
            return None

    def get_top_cited_papers(self, paper_id: str, limit: int = 10) -> List[Dict]:
        "This finds papers that cite this one and picks the top ones."
        normalized_id = self.normalize_paper_id(paper_id)
        try:
            self._rate_limit_delay()
            citing_papers = Works().filter(cites=normalized_id).sort(cited_by_count='desc')
            results = citing_papers.get(per_page=limit)
            out = []
            if results:
                for r in results:
                    fp = self.format_paper_for_node(r)
                    if fp:
                        out.append(fp)
            return out
        except Exception:
            # critical: on API failure, just return nothing
            return []

    def get_top_reference_papers(self, paper_id: str, limit: int = 10) -> List[Dict]:
        "This finds the main papers that this one references."
        paper_data = self.get_paper_data(paper_id)
        if not paper_data or not isinstance(paper_data, dict):
            return []
        refs = paper_data.get('referenced_works', [])
        if not isinstance(refs, list) or not refs:
            return []
        out = []
        for ref_id in refs[: max(limit * 2, limit)]:
            if not ref_id:
                continue
            ref_paper = self.get_paper_data(ref_id)
            fp = self.format_paper_for_node(ref_paper) if ref_paper else None
            if fp:
                out.append(fp)
        out.sort(key=lambda x: x.get('citations', 0) if x else 0, reverse=True)
        return out[:limit]

    def add_paper_to_graph(self, paper_id: str, is_root: bool = False) -> bool:
        "This adds a paper to the graph once."
        normalized_id = self.normalize_paper_id(paper_id)
        if normalized_id in self.added_papers:
            return False
        paper_data = self.get_paper_data(paper_id)
        if not paper_data or not isinstance(paper_data, dict):
            return False
        fp = self.format_paper_for_node(paper_data)
        if not fp:
            return False
        self.graph.add_node(normalized_id, **fp)
        self.added_papers.add(normalized_id)
        return True

    def remove_node(self, paper_id: str):
        pid = self.normalize_paper_id(paper_id)

        for edge in self.graph.edges(pid):
            self.graph.remove_edge(edge)

        self.graph.remove_node(paper_id)


    def build_graph_initial(self, root_paper_ids: list[str], iterations: int = 3,
                    top_cited_limit: int = 5, top_references_limit: int = 5) -> Dict:
        
        for root_paper in root_paper_ids:
            self.build_graph_from_a_root(root_paper, iterations, top_cited_limit, top_references_limit)

        return self.get_graph_data()

    def build_graph_from_a_root(self, root_paper_id: str, iterations: int = 3,
                    top_cited_limit: int = 5, top_references_limit: int = 5) -> Dict:
        "This grows a small citation graph around a starting paper."
        if not self.add_paper_to_graph(root_paper_id, is_root=True):
            return {'error': 'Could not fetch root paper'}
        current_level = [self.normalize_paper_id(root_paper_id)]
        for _ in range(iterations):
            next_level = []
            for pid in current_level:
                cited = self.get_top_cited_papers(pid, top_cited_limit)
                for cp in cited:
                    cid = cp.get('id')
                    if cid and self.add_paper_to_graph(cid):
                        self.graph.add_edge(cid, pid)
                        next_level.append(cid)
                refs = self.get_top_reference_papers(pid, top_references_limit)
                for rp in refs:
                    rid = rp.get('id')
                    if rid and self.add_paper_to_graph(rid):
                        self.graph.add_edge(pid, rid)
                        next_level.append(rid)

            current_level = next_level
            if not current_level:
                break        
    
    def get_graph_data(self) -> Dict:
        "This turns the graph into nodes/edges you can draw."
        nodes, edges = [], []
        pos = nx.spring_layout(self.graph, k=3, iterations=50)
        for nid, data in self.graph.nodes(data=True):
            nodes.append({
                'id': nid,
                'title': data.get('title', 'Untitled'),
                'authors': data.get('authors', []),
                'year': data.get('year'),
                'citations': data.get('citations', 0),
                'venue': data.get('venue'),
                'topics': data.get('topics', []),
                'is_open_access': data.get('is_open_access', False),
                'pdf_url': data.get('pdf_url'),
                'doi': data.get('doi'),
                'abstract': data.get('abstract', ''),
                'type': data.get('type'),
                'publication_date': data.get('publication_date'),
                'referenced_works_count': data.get('referenced_works_count', 0),
                'related_works_count': data.get('related_works_count', 0),
                'x': pos[nid][0],
                'y': pos[nid][1],
                'degree': self.graph.degree(nid),
                'in_degree': self.graph.in_degree(nid),
                'out_degree': self.graph.out_degree(nid)
            })
        for s, t in self.graph.edges():
            edges.append({'source': s, 'target': t, 'type': 'citation'})
        try:
            is_conn = nx.is_weakly_connected(self.graph)
        except Exception:
            is_conn = False
        return {
            'nodes': nodes,
            'edges': edges,
            'metadata': {
                'total_papers': len(nodes),
                'total_citations': len(edges),
                'generated_at': datetime.now().isoformat(),
                'graph_density': nx.density(self.graph),
                'is_connected': is_conn
            }
        }

    def get_paper_neighbors(self, paper_id: str) -> Dict:
        "This shows who cites this paper and who it cites."
        nid = self.normalize_paper_id(paper_id)
        if nid not in self.graph:
            return {'error': 'Paper not in graph'}
        citing = []
        for src in self.graph.predecessors(nid):
            d = self.graph.nodes[src]
            citing.append({'id': src, 'title': d.get('title', 'Untitled'),
                           'authors': d.get('authors', []), 'year': d.get('year'),
                           'citations': d.get('citations', 0)})
        refs = []
        for tgt in self.graph.successors(nid):
            d = self.graph.nodes[tgt]
            refs.append({'id': tgt, 'title': d.get('title', 'Untitled'),
                         'authors': d.get('authors', []), 'year': d.get('year'),
                         'citations': d.get('citations', 0)})
        return {
            'paper_id': nid,
            'citing_papers': citing,
            'referenced_papers': refs,
            'total_citing': len(citing),
            'total_referenced': len(refs)
        }

# Example usage and testing
if __name__ == "__main__":
    "This runs a quick demo to build a tiny graph."
    graph_builder = PaperGraph()
    test_paper_id = ["W2755950973"]
    print("Building citation graph...")
    result = graph_builder.build_graph_initial(
        root_paper_id=test_paper_id,
        iterations=2,
        top_cited_limit=3,
        top_references_limit=3
    )
    if 'error' not in result:
        print("Graph built successfully!")
        print(f"Total papers: {result['metadata']['total_papers']}")
        print(f"Total citations: {result['metadata']['total_citations']}")
        print(f"Graph density: {result['metadata']['graph_density']:.3f}")
    else:
        print(f"Error: {result['error']}")
