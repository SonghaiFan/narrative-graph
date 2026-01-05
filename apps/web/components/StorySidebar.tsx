import React, { useMemo, useState, useEffect } from 'react';
import { NarrativeNode } from '../types';
import { BookOpen, ChevronLeft, ChevronRight, Hash, ExternalLink, Globe } from 'lucide-react';
import { useGraphContext } from '../context/GraphContext';

interface ChapterCardProps {
    nodes: NarrativeNode[]; 
    timeIndex: number;
    activeAttribute: string;
}

// Helper to paginate multiple nodes at same T
const ChapterCard: React.FC<ChapterCardProps> = ({ 
    nodes, 
    timeIndex,
    activeAttribute 
}) => {
    const [page, setPage] = useState(0);

    // Reset page if nodes change significantly, but keep index if valid
    useEffect(() => {
        setPage(0);
    }, [nodes.length]); 

    const currentNode = nodes[page];
    if (!currentNode) return null;

    const hasMultiple = nodes.length > 1;
    const trackLabel = currentNode.attributes[activeAttribute]?.[0] || `Track ${currentNode.track + 1}`;

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 mb-6 flex flex-col overflow-hidden group">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-lg text-slate-800">Chapter {timeIndex + 1}</span>
                    <span className="text-[10px] font-mono text-slate-400 pt-1">t={timeIndex}</span>
                </div>
                
                {hasMultiple && (
                    <div className="flex items-center gap-1 bg-white rounded-md border border-slate-200 p-0.5 shadow-sm">
                        <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 disabled:hover:bg-transparent">
                            <ChevronLeft className="w-3 h-3 text-slate-600" />
                        </button>
                        <span className="text-[10px] font-medium text-slate-500 w-8 text-center select-none">{page + 1} / {nodes.length}</span>
                        <button disabled={page === nodes.length - 1} onClick={() => setPage(p => p + 1)} className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 disabled:hover:bg-transparent">
                            <ChevronRight className="w-3 h-3 text-slate-600" />
                        </button>
                    </div>
                )}
            </div>

            <div className="p-5 flex flex-col gap-3">
                <div className="flex">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wide border border-blue-100">
                        <Hash className="w-3 h-3 opacity-50" />
                        {trackLabel}
                    </span>
                </div>

                <div className="font-serif text-slate-700 leading-relaxed text-sm">
                    {currentNode.content ? (
                        <p>{currentNode.content}</p>
                    ) : (
                        <p className="text-slate-400 italic">No narrative content provided for this story unit.</p>
                    )}
                </div>

                <div className="mt-2 pt-3 border-t border-slate-50 flex flex-wrap gap-2">
                    {Object.entries(currentNode.attributes)
                        .filter(([k]) => k !== activeAttribute)
                        .map(([k, vals]) => (
                            <div key={k} className="text-[10px] text-slate-500">
                                <span className="font-semibold text-slate-600">{k}:</span> {vals.join(', ')}
                            </div>
                        ))
                    }
                </div>
            </div>
        </div>
    );
};

export const StorySidebar: React.FC = () => {
    const { graph, activeAttribute } = useGraphContext();
    
    const timeline = useMemo(() => {
        const groups = new Map<number, NarrativeNode[]>();
        graph.nodes.forEach(node => {
            if (!groups.has(node.time)) {
                groups.set(node.time, []);
            }
            groups.get(node.time)!.push(node);
        });

        const sortedTimes = Array.from(groups.keys()).sort((a, b) => a - b);
        
        return sortedTimes.map(t => {
            const nodes = groups.get(t)!.sort((a, b) => a.track - b.track);
            return { time: t, nodes };
        });
    }, [graph.nodes]);

    return (
        <div className="w-96 bg-white border-l border-slate-200 h-full flex flex-col shadow-xl z-20 shrink-0">
            <div className="px-6 py-5 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-slate-800" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Story View</span>
                </div>
                <h2 className="font-serif text-2xl font-bold text-slate-900">Narrative Arc</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-200">
                {timeline.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-60">
                        <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
                        <h3 className="font-serif text-lg font-medium text-slate-700 mb-1">Empty Story</h3>
                        <p className="text-xs text-slate-500 max-w-[200px]">
                            Drag motifs onto the grid to begin writing your narrative chapters.
                        </p>
                    </div>
                ) : (
                    <div className="max-w-md mx-auto relative">
                        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200 -z-10 hidden"></div>
                        {timeline.map((step) => (
                            <ChapterCard 
                                key={step.time} 
                                nodes={step.nodes} 
                                timeIndex={step.time}
                                activeAttribute={activeAttribute}
                            />
                        ))}
                        <div className="text-center mt-8 mb-4">
                            <span className="font-serif italic text-slate-400 text-sm">End of Narrative</span>
                        </div>
                    </div>
                )}
            </div>

            {graph.sources && graph.sources.length > 0 && (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-xs">
                     <div className="flex items-center gap-1.5 mb-2 text-slate-500 font-bold uppercase tracking-wider">
                        <Globe className="w-3.5 h-3.5" />
                        Research Sources
                     </div>
                     <div className="max-h-32 overflow-y-auto space-y-1.5 scrollbar-thin">
                        {graph.sources.map((source, idx) => (
                            <a 
                                key={idx}
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block truncate text-blue-600 hover:underline flex items-center gap-1.5 hover:bg-blue-50 p-1 rounded transition-colors"
                            >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                {source.title}
                            </a>
                        ))}
                     </div>
                </div>
            )}
        </div>
    );
};