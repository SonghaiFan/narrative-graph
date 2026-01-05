import React from 'react';
import { NarrativeGraph } from '../types';
import { CELL_WIDTH, CELL_HEIGHT, LABEL_WIDTH } from '../constants';

interface GridCanvasProps {
  graph: NarrativeGraph;
  width: number;
  height: number;
}

export const GridCanvas: React.FC<GridCanvasProps> = ({ graph, width, height }) => {
  return (
    <svg 
        className="absolute inset-0 pointer-events-none z-0" 
        width={width} 
        height={height}
        xmlns="http://www.w3.org/2000/svg"
    >
        <defs>
            <marker id="edge-arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#1f2937" />
            </marker>
        </defs>
        {graph.edges.map(edge => {
            const source = graph.nodes.find(n => n.id === edge.sourceId);
            const target = graph.nodes.find(n => n.id === edge.targetId);

            if (!source || !target) return null;

            // Calculate center positions
            const x1 = LABEL_WIDTH + source.time * CELL_WIDTH + (CELL_WIDTH / 2);
            const y1 = source.track * CELL_HEIGHT + (CELL_HEIGHT / 2);
            const x2 = LABEL_WIDTH + target.time * CELL_WIDTH + (CELL_WIDTH / 2);
            const y2 = target.track * CELL_HEIGHT + (CELL_HEIGHT / 2);

            return (
                <line
                    key={edge.id}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#1f2937" 
                    strokeWidth="2"
                    markerEnd="url(#edge-arrow)"
                />
            );
        })}
    </svg>
  );
};