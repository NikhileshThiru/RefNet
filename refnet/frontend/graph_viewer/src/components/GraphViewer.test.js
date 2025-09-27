import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GraphViewer from './GraphViewer';

// Mock D3
jest.mock('d3', () => ({
  select: jest.fn(() => ({
    selectAll: jest.fn(() => ({
      remove: jest.fn(),
      data: jest.fn(() => ({
        enter: jest.fn(() => ({
          append: jest.fn(() => ({
            attr: jest.fn(),
            style: jest.fn(),
            call: jest.fn(),
            on: jest.fn()
          }))
        }))
      }))
    })),
    append: jest.fn(() => ({
      attr: jest.fn(),
      style: jest.fn(),
      call: jest.fn(),
      on: jest.fn()
    })),
    call: jest.fn()
  })),
  forceSimulation: jest.fn(() => ({
    force: jest.fn(),
    on: jest.fn(),
    alphaTarget: jest.fn(() => ({
      restart: jest.fn()
    })),
    stop: jest.fn()
  })),
  forceLink: jest.fn(() => ({
    id: jest.fn(),
    distance: jest.fn()
  })),
  forceManyBody: jest.fn(() => ({
    strength: jest.fn()
  })),
  forceCenter: jest.fn(),
  forceCollide: jest.fn(() => ({
    radius: jest.fn()
  })),
  drag: jest.fn(() => ({
    on: jest.fn()
  })),
  zoom: jest.fn(() => ({
    scaleExtent: jest.fn(() => ({
      on: jest.fn()
    }))
  }))
}));

describe('GraphViewer Component', () => {
  test('renders complete graph viewer interface', () => {
    render(<GraphViewer />);
    
    // Check for search bar
    const searchInput = screen.getByPlaceholderText('Enter Keyword, DOI');
    expect(searchInput).toBeInTheDocument();
    
    // Check for references panel
    const referencesTitle = screen.getByText('References');
    expect(referencesTitle).toBeInTheDocument();
    
    // Check for control panel buttons
    const paperButton = screen.getByText('P');
    const edgeButton = screen.getByText('E');
    const tagButton = screen.getByText('T');
    
    expect(paperButton).toBeInTheDocument();
    expect(edgeButton).toBeInTheDocument();
    expect(tagButton).toBeInTheDocument();
    
    // Check for export button
    const exportButton = screen.getByText('Export');
    expect(exportButton).toBeInTheDocument();
  });

  test('search functionality works', () => {
    render(<GraphViewer />);
    const searchInput = screen.getByPlaceholderText('Enter Keyword, DOI');
    
    fireEvent.change(searchInput, { target: { value: 'Deep Learning' } });
    
    expect(searchInput.value).toBe('Deep Learning');
  });

  test('view switching works', () => {
    render(<GraphViewer />);
    const edgeButton = screen.getByText('E');
    
    fireEvent.click(edgeButton);
    
    expect(edgeButton).toHaveClass('active');
  });

  test('export functionality works', () => {
    // Mock URL.createObjectURL and related functions
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    // Mock document.createElement and related functions
    const mockAnchor = {
      href: '',
      download: '',
      click: jest.fn()
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});

    render(<GraphViewer />);
    const exportButton = screen.getByText('Export');
    
    fireEvent.click(exportButton);
    
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(mockAnchor.click).toHaveBeenCalled();
  });

  test('displays mock papers in references panel', () => {
    render(<GraphViewer />);
    
    // Check for first paper
    const firstPaper = screen.getByText(/1\. Deep Learning for Natural Language Processing/);
    expect(firstPaper).toBeInTheDocument();
    
    // Check for second paper
    const secondPaper = screen.getByText(/2\. Transformer Architecture in Modern AI/);
    expect(secondPaper).toBeInTheDocument();
  });

  test('handles empty search results', () => {
    render(<GraphViewer />);
    const searchInput = screen.getByPlaceholderText('Enter Keyword, DOI');
    
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    const noResults = screen.getByText('No papers found. Try a different search term.');
    expect(noResults).toBeInTheDocument();
  });
});