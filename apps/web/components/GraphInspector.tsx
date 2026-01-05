import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NarrativeNode, NarrativeEdge, NarrativeGraph } from '../types';
import { X, Plus, AlertCircle, Check, Trash2, AlignLeft, GripHorizontal, Network, Unlink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dropdown } from './Dropdown';
import { MultiSelectDropdown } from './MultiSelectDropdown';

interface GraphInspectorProps {
  type: 'node' | 'edge';
  data: NarrativeNode | NarrativeEdge;
  clusterNodes?: NarrativeNode[]; // For handling stacked nodes
  graph?: NarrativeGraph; // Required for Edge mode and Options derivation
  mode: 'preview' | 'edit';
  x: number;
  y: number;
  onClose: () => void;
  onUpdateNode: (id: string, data: { attributes: Record<string, string[]>, content: string }) => void;
  onSelectNode?: (id: string) => void;
  onDeleteNode?: (id: string) => void;
  activeAttribute: string;
  linkingAttribute: string;
  availableAttributes: string[];
  rowLabels: string[];
  onCreateTrack?: (val: string) => void;
}

export const GraphInspector: React.FC<GraphInspectorProps> = ({ 
    type,
    data, 
    clusterNodes = [],
    graph,
    mode,
    x,
    y,
    onClose, 
    onUpdateNode,
    onSelectNode,
    onDeleteNode,
    activeAttribute,
    linkingAttribute,
    availableAttributes,
    rowLabels,
    onCreateTrack
}) => {
  // --- NODE STATE ---
  const nodeData = type === 'node' ? (data as NarrativeNode) : null;
  const [localAttributes, setLocalAttributes] = useState<Record<string, string[]>>(nodeData?.attributes || {});
  const [localContent, setLocalContent] = useState<string>(nodeData?.content || '');
  
  // --- EDGE STATE ---
  const edgeData = type === 'edge' ? (data as NarrativeEdge) : null;
  
  // Dragging State
  const [position, setPosition] = useState({ x, y });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });

  const validRowLabels = rowLabels.filter(Boolean);

  // Reset state when data changes
  useEffect(() => {
    if (type === 'node' && nodeData) {
        setLocalAttributes(nodeData.attributes);
        setLocalContent(nodeData.content || '');
    }
    
    // Reset position logic: If preview, snap to target. If edit, allow persistence or smart placement.
    // In Portal mode, x and y are viewport coordinates passed from parent.
    // For preview (tooltip), we always want to track the node (x,y updates on scroll).
    // For edit, we want it to spawn near the node but then be draggable.
    
    // Note: Since we are using Portals, we must rely on x/y props for initial placement.
    // If x/y change due to scroll, we update position unless dragging.
    if (!isDragging.current) {
        setPosition({ 
            x: x + 25, 
            y: mode === 'edit' ? y - (type === 'node' ? 100 : 50) : y + 25 
        });
    }
  }, [data.id, mode, type, x, y]); // Depend on x,y to update position on scroll

  // Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
      if (mode !== 'edit') return;
      
      e.preventDefault();
      e.stopPropagation();
      
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      startPos.current = { ...position };

      const handlePointerMove = (e: PointerEvent) => {
          if (!isDragging.current) return;
          const dx = e.clientX - dragStart.current.x;
          const dy = e.clientY - dragStart.current.y;
          
          setPosition({
              x: startPos.current.x + dx,
              y: startPos.current.y + dy
          });
      };

      const handlePointerUp = () => {
          isDragging.current = false;
          document.removeEventListener('pointermove', handlePointerMove);
          document.removeEventListener('pointerup', handlePointerUp);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
  };

  // --- NODE LOGIC ---
  const handleMultiAttrChange = (key: string, values: string[]) => {
    setLocalAttributes(prev => ({ ...prev, [key]: values }));
  };

  const handleSaveNode = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (nodeData) {
          onUpdateNode(nodeData.id, {
              attributes: localAttributes,
              content: localContent
          });
          onClose();
      }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDeleteNode && nodeData) {
          onDeleteNode(nodeData.id);
      }
  };

  const getOptionsForAttribute = (attr: string) => {
    if (!graph) return [];
    const opts = new Set<string>();
    graph.nodes.forEach(n => {
        n.attributes[attr]?.forEach(v => {
            if(v) opts.add(v);
        });
    });
    return Array.from(opts).sort();
  };

  // Pagination Logic
  const currentIndex = clusterNodes.findIndex(n => n.id === nodeData?.id);
  const hasMultipleNodes = clusterNodes.length > 1;

  const handleNext = () => {
      if (!onSelectNode) return;
      const nextIdx = (currentIndex + 1) % clusterNodes.length;
      onSelectNode(clusterNodes[nextIdx].id);
  };

  const handlePrev = () => {
      if (!onSelectNode) return;
      const prevIdx = (currentIndex - 1 + clusterNodes.length) % clusterNodes.length;
      onSelectNode(clusterNodes[prevIdx].id);
  };

  // --- EDGE LOGIC ---
  const breakLink = (valToRemove: string) => {
      if (!graph || !edgeData) return;
      const targetNode = graph.nodes.find(n => n.id === edgeData.targetId);
      if (!targetNode) return;

      if (window.confirm(`Break this link by removing "${valToRemove}" from the target node?`)) {
          const currentVals = targetNode.attributes[linkingAttribute] || [];
          const newVals = currentVals.filter(v => v !== valToRemove);
          
          const newAttributes = {
              ...targetNode.attributes,
              [linkingAttribute]: newVals
          };
          
          onUpdateNode(targetNode.id, {
              attributes: newAttributes,
              content: targetNode.content || ''
          });
          onClose();
      }
  };

  const content = (
    <div 
        className={`absolute ${mode === 'preview' ? 'z-[9999]' : 'z-[10000]'}`}
        style={{ left: position.x, top: position.y }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
    >
        {/* RENDER: PREVIEW MODE (Node Only) */}
        {mode === 'preview' && type === 'node' && (() => {
            const displayNodes = clusterNodes.length > 0 ? clusterNodes : (nodeData ? [nodeData] : []);
            return (
                <div className="pointer-events-none bg-white/95 backdrop-blur text-slate-800 text-[10px] p-2 rounded-lg shadow-xl flex flex-col gap-2 max-w-[240px] max-h-[400px] border border-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1 px-1">
                        <span className="font-bold uppercase tracking-wider text-blue-600">
                            {displayNodes.length > 1 ? `Cluster (${displayNodes.length})` : 'Fabula'}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">Click to Edit</span>
                    </div>
                    
                    <div className="overflow-y-auto flex flex-col gap-2 max-h-[300px]">
                        {displayNodes.map((node, idx) => (
                            <div key={node.id} className={`flex flex-col gap-1 ${idx > 0 ? 'border-t border-slate-100 pt-2' : ''}`}>
                                {displayNodes.length > 1 && (
                                    <div className="text-[9px] font-bold text-slate-400">#{idx + 1}</div>
                                )}
                                <div className="text-slate-600 text-xs italic leading-relaxed">
                                    {node.content ? `"${node.content}"` : <span className="text-slate-400">(No statement)</span>}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    {Object.entries(node.attributes).map(([k, vals]) => (
                                        <div key={k} className="flex gap-2 justify-between items-start">
                                            <span className="text-slate-400 font-medium shrink-0">{k}:</span>
                                            <span className="text-right text-slate-800 break-words font-medium">
                                                {vals.join(', ') || '-'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        })()}

        {/* RENDER: EDIT MODE */}
        {mode === 'edit' && (
            <div className="w-80 bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-slate-900/5">
                {/* Header */}
                <div 
                    className="h-10 bg-slate-50/80 backdrop-blur border-b border-slate-200 flex items-center justify-between px-3 shrink-0 cursor-move active:cursor-grabbing select-none"
                    onPointerDown={handlePointerDown}
                >
                    <div className="flex items-center gap-2">
                        {type === 'node' ? <GripHorizontal className="w-3.5 h-3.5 text-slate-400" /> : <Network className="w-3.5 h-3.5 text-slate-400" />}
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {type === 'node' ? 'Edit Node' : 'Inspect Edge'}
                        </span>
                    </div>

                    {/* Pagination Controls */}
                    {type === 'node' && hasMultipleNodes && (
                        <div className="flex items-center gap-1 bg-white rounded-md border border-slate-200 p-0.5 shadow-sm" onPointerDown={(e) => e.stopPropagation()}>
                            <button 
                                onClick={handlePrev}
                                className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                            >
                                <ChevronLeft className="w-3 h-3" />
                            </button>
                            <span className="text-[10px] font-medium text-slate-500 w-12 text-center select-none">
                                {currentIndex + 1} of {clusterNodes.length}
                            </span>
                            <button 
                                onClick={handleNext}
                                className="p-0.5 hover:bg-slate-100 rounded text-slate-600"
                            >
                                <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    <button 
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()} 
                        onClick={onClose} 
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
                
                <div className="p-4 space-y-4 overflow-y-auto max-h-[400px]">
                    {/* NODE CONTENT */}
                    {type === 'node' && nodeData && (
                        <>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-slate-400">Source Motif</label>
                                <div className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">{nodeData.motifSource || 'Manual'}</div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <AlignLeft className="w-3 h-3 text-slate-400" />
                                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">Statement</label>
                                </div>
                                <textarea 
                                    autoFocus
                                    value={localContent}
                                    onChange={(e) => setLocalContent(e.target.value)}
                                    placeholder="Write the narrative..."
                                    className="w-full h-24 text-sm px-3 py-2 border border-slate-200 rounded-lg focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50/50 resize-none leading-relaxed text-slate-700 bg-white placeholder:text-slate-300 transition-all"
                                />
                            </div>

                            <div className="h-px bg-slate-100 w-full"></div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-800 block uppercase tracking-wide">Attributes</label>
                                
                                {availableAttributes.map(attr => {
                                    const isActive = attr === activeAttribute;
                                    const vals = localAttributes[attr] || [];
                                    
                                    const options = Array.from(new Set([
                                        ...getOptionsForAttribute(attr), 
                                        ...(isActive ? validRowLabels : [])
                                    ])).sort();

                                    return (
                                        <div key={attr} className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs text-slate-500 font-medium">{attr}</label>
                                                {isActive && (
                                                    <span className="text-[9px] px-1.5 py-px bg-blue-50 text-blue-600 rounded border border-blue-100 font-bold uppercase">
                                                        &alpha; Axis
                                                    </span>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <MultiSelectDropdown 
                                                    selectedValues={vals}
                                                    options={options}
                                                    onChange={(newVals) => handleMultiAttrChange(attr, newVals)}
                                                    onAdd={() => {}} 
                                                    placeholder={isActive ? "Select tracks..." : "Select or add..."}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-2 flex gap-2">
                                {onDeleteNode && (
                                    <button 
                                        type="button"
                                        onClick={handleDeleteClick}
                                        className="flex-1 bg-white border border-red-200 text-red-600 text-xs font-semibold py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete
                                    </button>
                                )}
                                <button 
                                    type="button"
                                    onClick={handleSaveNode}
                                    className="flex-[2] bg-slate-900 text-white text-xs font-semibold py-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-slate-200"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    Save Changes
                                </button>
                            </div>
                        </>
                    )}

                    {/* EDGE CONTENT */}
                    {type === 'edge' && edgeData && graph && (() => {
                        const source = graph.nodes.find(n => n.id === edgeData.sourceId);
                        const target = graph.nodes.find(n => n.id === edgeData.targetId);
                        
                        if (!source || !target) return <div className="text-xs text-red-500">Invalid Edge Reference</div>;
                        
                        const sourceVals = source.attributes[linkingAttribute] || [];
                        const targetVals = target.attributes[linkingAttribute] || [];
                        const sharedValues = sourceVals.filter(v => targetVals.includes(v));
                        
                        return (
                            <>
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
                                        <div className="flex flex-col gap-2">
                                            {sharedValues.map(val => (
                                                <div key={val} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded hover:bg-slate-100 transition-colors group">
                                                    <span className="text-xs text-slate-700 font-medium">{val}</span>
                                                    <button 
                                                        onClick={() => breakLink(val)}
                                                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 hover:bg-red-100 transition-all"
                                                        title="Remove this value from target to break link"
                                                    >
                                                        <Unlink className="w-3 h-3" />
                                                        Break
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-400 italic">No direct match found (implicit connection)</div>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>
        )}
    </div>
  );

  return createPortal(content, document.body);
};