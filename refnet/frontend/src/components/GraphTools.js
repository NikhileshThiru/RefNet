import React from 'react';
import { useRegisterFrontendTool } from 'cedar-os';
import { z } from 'zod';

function GraphTools() {
  // Register a tool to update the graph visualization
  useRegisterFrontendTool({
    name: 'updateGraphVisualization',
    description: 'Update the graph visualization with new nodes and edges',
    execute: ({ updatedGraph, expansionDetails, paperTitle, expansionType, depthAdded }) => {
      console.log('🔧 Frontend tool: updateGraphVisualization called');
      console.log('📊 Graph data:', {
        nodes: updatedGraph.nodes?.length || 0,
        edges: updatedGraph.edges?.length || 0,
        expansionDetails,
        paperTitle,
        expansionType,
        depthAdded
      });

      // Emit a custom event to update the graph visualization
      const graphUpdateEvent = new CustomEvent('graphUpdate', {
        detail: {
          updatedGraph,
          expansionDetails,
          paperTitle,
          expansionType,
          depthAdded,
          manipulationType: 'expand'
        }
      });
      
      window.dispatchEvent(graphUpdateEvent);
      
      console.log('✅ Graph update event dispatched');
    },
    argsSchema: z.object({
      updatedGraph: z.object({
        nodes: z.array(z.any()).describe('Array of graph nodes'),
        edges: z.array(z.any()).describe('Array of graph edges')
      }).describe('The updated graph data'),
      expansionDetails: z.object({
        new_papers_added: z.number().describe('Number of new papers added'),
        final_papers: z.number().describe('Final number of papers in graph'),
        iterations_completed: z.number().describe('Number of expansion iterations completed')
      }).describe('Details about the graph expansion'),
      paperTitle: z.string().describe('Title of the paper that was expanded'),
      expansionType: z.enum(['citations', 'references', 'both']).describe('Type of expansion performed'),
      depthAdded: z.number().describe('Number of depth levels added')
    })
  });

  // Register a tool to show expansion notifications
  useRegisterFrontendTool({
    name: 'showExpansionNotification',
    description: 'Show a notification about graph expansion results',
    execute: ({ message, type = 'success' }) => {
      console.log(`📢 ${type.toUpperCase()}: ${message}`);
      
      // Create a temporary notification element
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        max-width: 300px;
        word-wrap: break-word;
      `;
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 5000);
    },
    argsSchema: z.object({
      message: z.string().describe('The notification message'),
      type: z.enum(['success', 'error', 'info']).default('success').describe('Notification type')
    })
  });

  // Register a tool to show general notifications
  useRegisterFrontendTool({
    name: 'showNotification',
    description: 'Show a general notification to the user',
    execute: ({ message, type = 'info' }) => {
      console.log(`📢 ${type.toUpperCase()}: ${message}`);
      
      // Create a temporary notification element
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        max-width: 300px;
        word-wrap: break-word;
      `;
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 5000);
    },
    argsSchema: z.object({
      message: z.string().describe('The notification message'),
      type: z.enum(['success', 'error', 'info']).default('info').describe('Notification type')
    })
  });

  // Register a tool to toggle text box creation mode
  useRegisterFrontendTool({
    name: 'toggleTextBoxMode',
    description: 'Toggle text box creation mode for the graph viewer',
    execute: ({ enabled }) => {
      console.log('🔧 Frontend tool: toggleTextBoxMode called', { enabled });
      
      // Emit a custom event to toggle text box mode
      const textBoxModeEvent = new CustomEvent('toggleTextBoxMode', {
        detail: { enabled }
      });
      
      window.dispatchEvent(textBoxModeEvent);
      
      console.log('✅ Text box mode toggle event dispatched');
    },
    argsSchema: z.object({
      enabled: z.boolean().describe('Whether to enable text box creation mode')
    })
  });

  // Register a tool to create a text box at specific coordinates
  useRegisterFrontendTool({
    name: 'createTextBox',
    description: 'Create a text box at specific coordinates on the graph',
    execute: ({ x, y, width, height, text = '' }) => {
      console.log('🔧 Frontend tool: createTextBox called', { x, y, width, height, text });
      
      // Emit a custom event to create a text box
      const createTextBoxEvent = new CustomEvent('createTextBox', {
        detail: { x, y, width, height, text }
      });
      
      window.dispatchEvent(createTextBoxEvent);
      
      console.log('✅ Create text box event dispatched');
    },
    argsSchema: z.object({
      x: z.number().describe('X coordinate for the text box'),
      y: z.number().describe('Y coordinate for the text box'),
      width: z.number().describe('Width of the text box'),
      height: z.number().describe('Height of the text box'),
      text: z.string().optional().describe('Initial text content for the text box')
    })
  });

  return null; // This component only registers tools
}

export default GraphTools;