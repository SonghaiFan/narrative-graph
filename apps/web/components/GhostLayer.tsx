import React, { useMemo } from 'react';
import { Motif, NarrativeNode, NarrativeGraph } from '../types';
import { CELL_WIDTH, CELL_HEIGHT } from '../constants';
import { EdgeLayer } from './GraphVisual';
import { NarrativeNodeItem } from './NarrativeNodeItem';

interface GhostLayerProps {
  graph: NarrativeGraph; // Added to check for collisions
  draggedMotif: Motif | null;
  draggedNode: NarrativeNode | null;
  hoverCell: { t: number, h: number } | null;
  gridRows: number;
  gridCols: number;
  offsetX: number;
}

export const GhostLayer: React.FC<GhostLayerProps> = ({
  graph,
  draggedMotif,
  draggedNode,
  hoverCell,
  gridRows,
  gridCols,
  offsetX
}) => {
  const ghostData = useMemo(() => {
    if (!hoverCell) return null;
    
    // Case 1: Dragging a Motif
    if (draggedMotif) {
        // Project motif onto grid
        const projectedNodes: NarrativeNode[] = draggedMotif.nodes.map((n, i) => ({
            id: `ghost-${i}`,
            time: hoverCell.t + n.relTime,
            track: hoverCell.h + n.relTrack,
            attributes: {} // Dummy
        }));

        // Filter out of bounds
        const validIndices = new Set<number>();
        const validNodes = projectedNodes.filter((n, i) => {
            const isValid = n.time >= 0 && n.time < gridCols && n.track >= 0 && n.track < gridRows;
            if (isValid) validIndices.add(i);
            return isValid;
        });

        // Calculate Edges based on valid nodes
        const edges = draggedMotif.edges
            .filter(e => validIndices.has(e.sourceIndex) && validIndices.has(e.targetIndex))
            .map((e, i) => ({
                id: `ghost-edge-${i}`,
                source: { x: projectedNodes[e.sourceIndex].time, y: projectedNodes[e.sourceIndex].track },
                target: { x: projectedNodes[e.targetIndex].time, y: projectedNodes[e.targetIndex].track },
                isGhost: true
            }));

        return { nodes: validNodes, edges, type: 'MOTIF' };

    } 
    // Case 2: Dragging a Node
    else if (draggedNode) {
        if (hoverCell.t < gridCols && hoverCell.h < gridRows) {
            return {
                nodes: [{
                    id: draggedNode.id,
                    time: hoverCell.t,
                    track: hoverCell.h,
                    attributes: {}
                }],
                edges: [],
                type: 'NODE'
            };
        }
    }
    // Case 3: Hovering (Creation Preview)
    else {
         // Check if a node already exists here
         const exists = graph.nodes.some(n => n.time === hoverCell.t && n.track === hoverCell.h);
         
         if (!exists && hoverCell.t < gridCols && hoverCell.h < gridRows) {
             return {
                 nodes: [{
                     id: 'creation-ghost',
                     time: hoverCell.t,
                     track: hoverCell.h,
                     attributes: {}
                 }],
                 edges: [],
                 type: 'CREATION'
             };
         }
    }

    return null;
  }, [draggedMotif, draggedNode, hoverCell, gridRows, gridCols, graph.nodes]);

  if (!ghostData) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Ghost Edges */}
      <EdgeLayer
        edges={ghostData.edges}
        width={offsetX + gridCols * CELL_WIDTH}
        height={gridRows * CELL_HEIGHT}
        offsetX={offsetX}
        offsetY={0}
      />

      {/* Ghost Nodes */}
      {ghostData.nodes.map((node) => (
        <NarrativeNodeItem
          key={`ghost-node-${node.id}`}
          node={node}
          isSelected={false}
          isHovered={false}
          isGhost={true}
          // Note: label="+" is now handled internally by NarrativeNodeItem when isGhost=true
          offsetX={offsetX}
          offsetY={0}
          onClick={() => {}}
          onHover={() => {}}
        />
      ))}
    </div>
  );
};