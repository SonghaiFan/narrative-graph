
import React from 'react';
import { NarrativeEdge, NarrativeGraph } from '../types';
import { X, Network } from 'lucide-react';

interface EdgeInspectorProps {
  edge: NarrativeEdge;
  graph: NarrativeGraph;
  linkingAttribute: string;
  onClose: () => void;
}

export const EdgeInspector: React.FC<EdgeInspectorProps> = ({ 
    edge, 
    graph,
    linkingAttribute,
    onClose 
}) => {
    const source = graph.nodes.find(n => n.id === edge.sourceId);
    const target = graph.nodes.find(n => n.id === edge.targetId);

    if (!source || !target) return null;

    const sourceVals = source.attributes[linkingAttribute] || [];
    const targetVals = target.attributes[linkingAttribute] || [];
    const sharedValues = sourceVals.filter(v => targetVals.includes(v));

    return (
        <div 
            className="absolute right-6 top-20 w-72 bg-white rounded-lg shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden animate-in slide-in-from-right-10 fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <Network className="w-3 h-3 text-slate-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Narrative Link</span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                </button>
            </div>
            
            <div className="p-4 space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded p-3">
                    <div className="text-[10px] text-blue-500 font-bold uppercase tracking-wide mb-1">
                        Linking Rule (&beta;)
                    </div>
                    <div className="text-sm font-semibold text-blue-800">
                        Match by {linkingAttribute}
                    </div>
                </div>

                <div>
                    <div className="text-xs font-medium text-slate-500 mb-2">Shared Values</div>
                    {sharedValues.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {sharedValues.map(val => (
                                <span key={val} className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-700 font-medium">
                                    {val}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-slate-400 italic">No direct match found (implicit connection)</div>
                    )}
                </div>

                <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-3">
                    Edges are automatically derived when adjacent nodes share values in the linking attribute.
                </div>
            </div>
        </div>
    );
};
