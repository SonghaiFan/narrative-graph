import React from 'react';
import { CELL_WIDTH, CELL_HEIGHT, NODE_DIAMETER } from '../constants';

// Re-defining interface locally if not in types.ts to keep component self-contained
export interface RenderedEdge {
  id: string;
  source: { x: number; y: number };
  target: { x: number; y: number };
  isGhost?: boolean;
  isActive?: boolean;
}

interface EdgeLayerProps {
  edges: RenderedEdge[];
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
  interactive?: boolean;
  onEdgeClick?: (id: string, e: React.MouseEvent) => void;
}

export const EdgeLayer: React.FC<EdgeLayerProps> = ({
  edges,
  width,
  height,
  offsetX = 0,
  offsetY = 0,
  interactive = false,
  onEdgeClick
}) => {
  const nodeRadius = NODE_DIAMETER / 2;

  // Helper to calculate pixel coordinates
  const getCoords = (gridX: number, gridY: number) => ({
    cx: offsetX + gridX * CELL_WIDTH + CELL_WIDTH / 2,
    cy: offsetY + gridY * CELL_HEIGHT + CELL_HEIGHT / 2,
  });

  // Calculate Edge Geometry 
  // We draw from the edge of the source to the edge of the target.
  const getEdgeLine = (source: { x: number; y: number }, target: { x: number; y: number }) => {
    const start = getCoords(source.x, source.y);
    const end = getCoords(target.x, target.y);

    const dx = end.cx - start.cx;
    const dy = end.cy - start.cy;
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx * dx + dy * dy);
    
    // Gap corresponds to the radius.
    // The arrow tip (refX) is aligned with the end of the line.
    // So the line should end exactly at the target node's border.
    const gap = nodeRadius;

    if (length < gap * 2) return null; // Prevent drawing if nodes overlap too much

    return {
      x1: start.cx + gap * Math.cos(angle),
      y1: start.cy + gap * Math.sin(angle),
      x2: end.cx - gap * Math.cos(angle),
      y2: end.cy - gap * Math.sin(angle),
    };
  };

  return (
    <svg
      width={width}
      height={height}
      className="pointer-events-none overflow-visible"
    >
      <defs>
        {/* 
            Markers: 
            viewBox 0 0 12 10. 
            Path creates a triangle 12px long, 10px wide.
            refX="12" puts the attachment point at the tip. 
            Fill is black (#000000) for the bold style.
        */}
        <marker id="edge-arrow-active" markerWidth="12" markerHeight="10" refX="12" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L0,10 L12,5 z" fill="#000000" />
        </marker>
        <marker id="edge-arrow-selected" markerWidth="12" markerHeight="10" refX="12" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L0,10 L12,5 z" fill="#3b82f6" />
        </marker>
        <marker id="edge-arrow-ghost" markerWidth="12" markerHeight="10" refX="12" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L0,10 L12,5 z" fill="#94a3b8" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const coords = getEdgeLine(edge.source, edge.target);
        if (!coords) return null;

        const isSelected = edge.isActive;
        const isGhost = edge.isGhost;
        
        return (
          <g 
            key={edge.id} 
            onClick={(e) => {
                if (interactive && onEdgeClick && !isGhost) {
                    e.stopPropagation();
                    onEdgeClick(edge.id, e);
                }
            }}
            className={interactive && !isGhost ? "cursor-pointer pointer-events-auto" : ""}
          >
             {/* Wide Invisible Hit Path for easier clicking */}
             {!isGhost && (
                <line
                    x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}
                    stroke="transparent"
                    strokeWidth="20"
                />
             )}
             
             {/* Visible Line: Thick black line */}
             <line
                x1={coords.x1}
                y1={coords.y1}
                x2={coords.x2}
                y2={coords.y2}
                stroke={isGhost ? "#94a3b8" : (isSelected ? "#3b82f6" : "#000000")}
                strokeWidth={isGhost ? 2 : (isSelected ? 5 : 3)}
                strokeDasharray={isGhost ? "4 4" : undefined}
                markerEnd={
                     isGhost 
                        ? "url(#edge-arrow-ghost)"
                        : (isSelected ? "url(#edge-arrow-selected)" : "url(#edge-arrow-active)")
                }
                opacity={isGhost ? 0.5 : 1}
             />
          </g>
        );
      })}
    </svg>
  );
};