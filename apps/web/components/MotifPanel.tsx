
import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { NARRATIVE_MOTIFS } from '../constants';
import { Motif } from '../types';
import { ArrowUpDown } from 'lucide-react';

// IDs of motifs that are vertically symmetric or identical when flipped
const SYMMETRIC_MOTIFS = ['linear', 'wide_branch', 'wide_merge'];

// --- Helper: Flip Motif Vertically ---
const flipMotif = (motif: Motif): Motif => {
    const ys = motif.nodes.map(n => n.relTrack);
    const minH = Math.min(...ys);
    const maxH = Math.max(...ys);

    const newNodes = motif.nodes.map(n => ({
        ...n,
        relTrack: (maxH + minH) - n.relTrack
    }));

    return {
        ...motif,
        nodes: newNodes,
        name: motif.name
    };
};

// --- Motif 3x3 Thumbnail Component ---
const MotifThumbnail = ({ motif }: { motif: Motif }) => {
    const cols = 3;
    const rows = 3;
    const cellSize = 24; // Slightly smaller for tighter fit
    const radius = 5;
    const padding = 12;

    const xs = motif.nodes.map(n => n.relTime);
    const ys = motif.nodes.map(n => n.relTrack);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    const offsetX = Math.floor((cols - width) / 2) - minX;
    const offsetY = Math.floor((rows - height) / 2) - minY;

    return (
        <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${cols * cellSize + padding * 2} ${rows * cellSize + padding * 2}`}
            className="pointer-events-none"
            preserveAspectRatio="xMidYMid meet"
        >
            <g transform={`translate(${padding + cellSize / 2}, ${padding + cellSize / 2})`}>
                {/* Grid Dots */}
                {Array.from({ length: cols }).map((_, c) => (
                    Array.from({ length: rows }).map((_, r) => (
                        <circle
                            key={`grid-${c}-${r}`}
                            cx={c * cellSize}
                            cy={r * cellSize}
                            r={1.5}
                            fill="#cbd5e1" // slate-300 dots
                        />
                    ))
                ))}

                {/* Edges */}
                {motif.edges.map((e, i) => {
                    const s = motif.nodes[e.sourceIndex];
                    const t = motif.nodes[e.targetIndex];
                    const sx = (s.relTime + offsetX) * cellSize;
                    const sy = (s.relTrack + offsetY) * cellSize;
                    const tx = (t.relTime + offsetX) * cellSize;
                    const ty = (t.relTrack + offsetY) * cellSize;

                    const dx = tx - sx;
                    const dy = ty - sy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const ratio = (dist - (radius + 2)) / dist;

                    if (dist === 0) return null;

                    return (
                        <line
                            key={`edge-${i}`}
                            x1={sx} y1={sy}
                            x2={sx + dx * ratio} y2={sy + dy * ratio}
                            stroke="#334155"
                            strokeWidth="1.5"
                        />
                    )
                })}

                {/* Nodes */}
                {motif.nodes.map((n, i) => (
                    <circle
                        key={`node-${i}`}
                        cx={(n.relTime + offsetX) * cellSize}
                        cy={(n.relTrack + offsetY) * cellSize}
                        r={radius}
                        fill="#ffffff"
                        stroke="#0f172a"
                        strokeWidth="2"
                    />
                ))}
            </g>
        </svg>
    )
}

// --- Draggable Card Component ---
interface DraggableMotifCardProps {
    motif: Motif;
    globalIndex: number;
    isFlipped: boolean;
    onToggleFlip: () => void;
}

const DraggableMotifCard: React.FC<DraggableMotifCardProps> = ({
    motif,
    globalIndex,
    isFlipped,
    onToggleFlip
}) => {
    const effectiveMotif = isFlipped ? flipMotif(motif) : motif;
    const canFlip = !SYMMETRIC_MOTIFS.includes(motif.id);

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `motif-${motif.id}`,
        data: { motif: effectiveMotif }
    });

    return (
        <div className="flex flex-col items-center gap-1 group mx-1">
            <div
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                title={effectiveMotif.name}
                className={`
                    relative w-[90px] aspect-square bg-white rounded-xl 
                    border transition-all duration-200 ease-out
                    flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden
                    ${isDragging
                        ? 'opacity-40 ring-2 ring-blue-500 border-transparent shadow-none'
                        : 'border-slate-200 shadow-sm hover:shadow-md hover:border-slate-400 hover:-translate-y-1'
                    }
                `}
            >
                {/* Visual Content */}
                <div className="w-full h-full p-1">
                    <MotifThumbnail motif={effectiveMotif} />
                </div>

                {/* Global Index Badge */}
                <div className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-slate-400">{globalIndex}</span>
                </div>

                {/* Flip Button Overlay */}
                {canFlip && (
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFlip();
                        }}
                        className={`
                            absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center
                            border transition-all duration-200
                            ${isFlipped
                                ? 'bg-blue-50 text-blue-600 border-blue-200 opacity-100'
                                : 'bg-white text-slate-400 border-slate-200 opacity-0 group-hover:opacity-100 hover:text-blue-600 hover:border-blue-200'
                            }
                        `}
                        title="Flip Vertically"
                    >
                        <ArrowUpDown className="w-3 h-3" />
                    </button>
                )}
            </div>

            {/* Label outside the card for cleaner look */}
            <div className="text-center">
                <span className="text-[10px] font-semibold text-slate-600 block leading-tight">{effectiveMotif.name}</span>
                {isFlipped && <span className="text-[8px] text-blue-500 font-medium block">Flipped</span>}
            </div>
        </div>
    );
}

interface MotifPanelProps { }

export const MotifPanel: React.FC<MotifPanelProps> = () => {
    const [flippedState, setFlippedState] = useState<Record<string, boolean>>({});

    const toggleFlip = (id: string) => {
        setFlippedState(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const sequential = NARRATIVE_MOTIFS.filter((m) => m.category === 'Sequential');
    const nonSequential = NARRATIVE_MOTIFS.filter((m) => m.category === 'Non-Sequential');

    const getGlobalIndex = (id: string) => {
        return NARRATIVE_MOTIFS.findIndex(m => m.id === id) + 1;
    };

    return (
        <div className="bg-white border-t border-slate-200 flex flex-col shrink-0 z-40 h-[190px] shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">

            {/* Header Bar */}
            <div className="px-6 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <span className="font-serif font-bold italic text-slate-800 text-sm">Motif Library</span>
                    <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full border border-slate-200">Drag to Grid</span>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 px-8 py-3 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                <div className="flex gap-12 min-w-max h-full items-start">

                    {/* Sequential Section */}
                    <div className="flex flex-col gap-2 h-full">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Sequential</h3>
                        <div className="flex gap-4">
                            {sequential.map(motif => (
                                <DraggableMotifCard
                                    key={motif.id}
                                    motif={motif}
                                    globalIndex={getGlobalIndex(motif.id)}
                                    isFlipped={!!flippedState[motif.id]}
                                    onToggleFlip={() => toggleFlip(motif.id)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Vertical Divider */}
                    <div className="w-px bg-slate-200 h-2/3 my-auto"></div>

                    {/* Non-Sequential Section */}
                    <div className="flex flex-col gap-2 h-full">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Non-Sequential</h3>
                        <div className="flex gap-4">
                            {nonSequential.map(motif => (
                                <DraggableMotifCard
                                    key={motif.id}
                                    motif={motif}
                                    globalIndex={getGlobalIndex(motif.id)}
                                    isFlipped={!!flippedState[motif.id]}
                                    onToggleFlip={() => toggleFlip(motif.id)}
                                />
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
