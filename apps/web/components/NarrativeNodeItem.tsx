
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { NarrativeNode } from '../types';
import { CELL_WIDTH, CELL_HEIGHT, NODE_DIAMETER } from '../constants';

interface NarrativeNodeItemProps {
  node: NarrativeNode;
  count?: number; // How many nodes are stacked here
  label?: string;
  isSelected: boolean;
  isHovered: boolean;
  isGhost?: boolean; // For drag overlay or projection
  isOverlay?: boolean; // New prop to identify if this is the drag preview
  color?: string; // New prop for track color
  offsetX: number;
  offsetY: number;
  onClick: (e: React.MouseEvent) => void;
  onHover: (state: boolean) => void;
}

export const NarrativeNodeItem: React.FC<NarrativeNodeItemProps> = ({
  node,
  count = 1,
  label,
  isSelected,
  isHovered,
  isGhost = false,
  isOverlay = false,
  color = '#007AEF', // Default to Blue
  offsetX,
  offsetY,
  onClick,
  onHover
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `node-${node.id}`,
    data: { type: 'NODE', id: node.id, node },
    disabled: isGhost || isOverlay // Ghosts and Overlay items aren't draggable sources
  });

  // Calculate position
  const left = offsetX + node.time * CELL_WIDTH + CELL_WIDTH / 2;
  const top = offsetY + node.track * CELL_HEIGHT + CELL_HEIGHT / 2;

  // Interaction State Logic
  const interactiveClass = (isOverlay || isGhost) ? "pointer-events-none" : "pointer-events-auto cursor-grab active:cursor-grabbing";
  
  // Z-Index handling: Bring selected/hovered to front
  const zIndex = isGhost ? 20 : (isSelected || isHovered ? 50 : 30);
  
  // Transform handling
  let transformStr = "translate(-50%, -50%)";
  if (isGhost) transformStr += " scale(0.9)";
  
  const baseClasses = `absolute rounded-full flex items-center justify-center transition-all duration-200 ${interactiveClass}`;

  // Style Construction
  let bgStyle = color;
  
  // Strict styling rules based on request: 3px solid black border
  const borderStyle = isGhost ? "2px dashed #000000" : "3px solid #000000";
  let opacity = 1;

  // Selection/Hover visual logic
  // Instead of changing border color, we add a ring/glow effect to preserve the black border
  let ringClass = "";
  if (!isGhost && (isSelected || isHovered)) {
      ringClass = "ring-4 ring-black/20 ring-offset-2";
  }

  if (isGhost) {
      bgStyle = "#ffffff"; 
      opacity = 0.6;
  } else if (isDragging) {
      opacity = 0.4;
  }

  // Calculate visible stack depth based on count
  // Cap at 5 background layers for visual sanity
  const stackDepth = Math.min(count - 1, 5);

  return (
    <div
      ref={setNodeRef}
      style={{
        width: NODE_DIAMETER,
        height: NODE_DIAMETER,
        left: left,
        top: top,
        transform: transformStr, 
        touchAction: 'none',
        zIndex: zIndex
      }}
      className={`${baseClasses} ${ringClass}`}
      onClick={(e) => {
          if (!isGhost && !isOverlay) {
            e.stopPropagation(); 
            onClick(e);
          }
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      {...listeners}
      {...attributes}
    >
      {/* Dynamic Stack Effect: Renders proportional layers based on count */}
      {!isGhost && stackDepth > 0 && Array.from({ length: stackDepth }).map((_, i) => (
          <div 
            key={i}
            className="absolute inset-0 rounded-full border-2 border-black bg-white"
            style={{ 
                zIndex: -1 - i, // Stack them backwards
                // Shift Right-Up progressively. Using 3px steps.
                transform: `translate(${3 * (i + 1)}px, -${3 * (i + 1)}px)` 
            }}
          />
      ))}

      {/* Main Visual Circle */}
      <div 
          className="w-full h-full rounded-full box-border flex items-center justify-center transition-colors duration-200 relative overflow-hidden"
          style={{
              backgroundColor: bgStyle,
              border: borderStyle,
              opacity: opacity,
              boxShadow: 'none'
          }}
      >
          {/* Label Logic: Only show real labels, no "+" for ghosts */}
          {!isGhost && (
              count > 1 ? (
                  <span className="text-white text-xs font-black select-none leading-none drop-shadow-md">
                      {count}
                  </span>
              ) : (
                  label && (
                      <span className="text-black/80 text-[10px] font-black select-none leading-none">
                          {label}
                      </span>
                  )
              )
          )}
      </div>
    </div>
  );
};
