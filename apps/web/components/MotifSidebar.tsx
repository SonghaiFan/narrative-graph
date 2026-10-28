import React from 'react';
import { NARRATIVE_MOTIFS } from '../constants';
import { Motif } from '../types';
import { GripVertical, Info } from 'lucide-react';

interface MotifSidebarProps {
  onDragStart: (e: React.DragEvent, motif: Motif) => void;
}

export const MotifSidebar: React.FC<MotifSidebarProps> = ({ onDragStart }) => {
  const sequential = NARRATIVE_MOTIFS.filter((m) => m.category === 'Sequential');
  const nonSequential = NARRATIVE_MOTIFS.filter((m) => m.category === 'Non-Sequential');

  const renderMotifCard = (motif: Motif) => (
    <div
      key={motif.id}
      draggable
      onDragStart={(e) => onDragStart(e, motif)}
      className="bg-white border border-slate-200 rounded-md p-3 mb-3 cursor-grab hover:shadow-md transition-shadow active:cursor-grabbing group relative"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm text-slate-800">{motif.name}</span>
        <GripVertical className="w-4 h-4 text-slate-400" />
      </div>
      
      {/* Mini Visual Representation */}
      <div className="h-16 w-full bg-slate-50 rounded border border-slate-100 relative overflow-hidden">
        {renderMiniPreview(motif)}
      </div>

      <div className="mt-2 text-xs text-slate-500 line-clamp-2">{motif.description}</div>
    </div>
  );

  // A tiny SVG preview of the motif
  const renderMiniPreview = (motif: Motif) => {
    // Determine bounds to center it
    const maxT = Math.max(...motif.nodes.map(n => n.relTime));
    const maxH = Math.max(...motif.nodes.map(n => n.relTrack));
    const minH = Math.min(...motif.nodes.map(n => n.relTrack));
    
    // Scale factors
    const w = 20; 
    const h = 15;
    const marginX = 10;
    const marginY = 10;
    
    return (
      <svg className="w-full h-full" viewBox="-10 -10 80 60" preserveAspectRatio="xMidYMid meet">
        <defs>
            <marker id={`arrow-${motif.id}`} markerWidth="6" markerHeight="6" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
            </marker>
        </defs>
        {motif.edges.map((e, idx) => {
          const start = motif.nodes[e.sourceIndex];
          const end = motif.nodes[e.targetIndex];
          return (
            <line
              key={idx}
              x1={start.relTime * w + marginX}
              y1={start.relTrack * h + marginY}
              x2={end.relTime * w + marginX}
              y2={end.relTrack * h + marginY}
              stroke="#94a3b8"
              strokeWidth="1.5"
              markerEnd={`url(#arrow-${motif.id})`}
            />
          );
        })}
        {motif.nodes.map((n, idx) => (
          <circle
            key={idx}
            cx={n.relTime * w + marginX}
            cy={n.relTrack * h + marginY}
            r="4"
            className="fill-slate-600"
          />
        ))}
      </svg>
    );
  };

  return (
    <div className="w-72 bg-slate-50 border-r border-slate-200 h-full flex flex-col shadow-xl z-10">
      <div className="p-5 border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold serif text-slate-900">Narrative Motifs</h1>
        <p className="text-xs text-slate-500 mt-1">Drag patterns to the grid</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-200">
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1">Sequential</h3>
          {sequential.map(renderMotifCard)}
        </div>
        
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1">Non-Sequential</h3>
          {nonSequential.map(renderMotifCard)}
        </div>
      </div>
      
      <div className="p-4 bg-slate-100 border-t border-slate-200 text-xs text-slate-500 flex items-start gap-2">
         <Info className="w-4 h-4 mt-0.5 shrink-0" />
         <p>Tracks (H) represent entities or topics. Time (T) flows left to right.</p>
      </div>
    </div>
  );
};
