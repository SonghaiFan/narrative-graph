import { NarrativeGraph, NarrativeNode, Source } from '../types';

export interface ExportData {
  graph: NarrativeGraph;
  gridConfig: {
    rows: number;
    cols: number;
  };
  availableAttributes: string[];
  activeAttribute: string;
  linkingAttribute: string;
  rowLabelMap: Record<string, string[]>;
  visibleRowLabels: string[];
  exportDate: string;
  version: string;
}

/**
 * Export the graph data as JSON
 */
export const exportGraphAsJSON = (data: ExportData): void => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `narrative-graph-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export the graph visualization as PNG using html2canvas
 */
export const exportGraphAsPNG = async (element: HTMLElement, filename?: string): Promise<void> => {
  try {
    const html2canvas = await import('html2canvas');
    
    const canvas = await html2canvas.default(element, {
      backgroundColor: '#ffffff',
      scale: 2, // Higher quality
      logging: false,
      useCORS: true,
      allowTaint: true,
    });

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob: Blob | null) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename || `narrative-graph-${new Date().toISOString().split('T')[0]}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          resolve();
        },
        'image/png',
        1.0
      );
    });
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    if (errorMessage.includes('Failed to resolve') || errorMessage.includes('Cannot find module')) {
      throw new Error('html2canvas is not installed. Please install it to enable PNG export:\n\nnpm install html2canvas');
    }
    throw new Error(`PNG export failed: ${errorMessage}`);
  }
};

/**
 * Export the graph visualization as SVG
 * Note: This creates an SVG wrapper around the HTML element
 */
export const exportGraphAsSVG = (element: HTMLElement, filename?: string): void => {
  try {
    // Get the element's dimensions
    const width = element.offsetWidth || element.scrollWidth;
    const height = element.offsetHeight || element.scrollHeight;
    
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Get computed styles
    const computedStyles = window.getComputedStyle(element);
    
    // Create SVG with foreignObject to embed HTML
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', width.toString());
    svg.setAttribute('height', height.toString());
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    
    // Add style element
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      .export-content {
        font-family: ${computedStyles.fontFamily};
        font-size: ${computedStyles.fontSize};
        color: ${computedStyles.color};
      }
    `;
    svg.appendChild(style);
    
    // Create foreignObject to embed HTML
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('width', '100%');
    foreignObject.setAttribute('height', '100%');
    foreignObject.setAttribute('x', '0');
    foreignObject.setAttribute('y', '0');
    
    // Create a div wrapper for the cloned content
    const div = document.createElement('div');
    div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    div.style.width = width + 'px';
    div.style.height = height + 'px';
    div.style.backgroundColor = computedStyles.backgroundColor || '#ffffff';
    div.appendChild(clone);
    foreignObject.appendChild(div);
    svg.appendChild(foreignObject);
    
    // Serialize to string
    const svgString = new XMLSerializer().serializeToString(svg);
    
    // Create blob and download
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `narrative-graph-${new Date().toISOString().split('T')[0]}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('SVG export failed:', error);
    alert('Failed to export as SVG. Please try PNG export instead.');
  }
};

