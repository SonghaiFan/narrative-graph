import React, { useState, useEffect, useRef } from 'react';
import { NarrativeNode } from '../types';
import { X, Plus, AlertCircle, Check, Trash2, AlignLeft, Edit2, GripHorizontal } from 'lucide-react';
import { Dropdown } from './Dropdown';

interface NodeInspectorProps {
  node: NarrativeNode;
  mode: 'preview' | 'edit';
  x: number;
  y: number;
  onClose: () => void;
  onUpdateNode: (id: string, data: { attributes: Record<string, string[]>, content: string }) => void;
  onDelete: () => void;
  activeAttribute: string;
  availableAttributes: string[];
  rowLabels: string[];
  onCreateTrack: (val: string) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({ 
    node, 
    mode,
    x,
    y,
    onClose, 
    onUpdateNode,
    onDelete,
    activeAttribute,
    availableAttributes,
    rowLabels,
    onCreateTrack
}) => {
  // Local buffer state
  const [localAttributes, setLocalAttributes] = useState<Record<string, string[]>>(node.attributes);
  const [localContent, setLocalContent] = useState<string>(node.content || '');
  
  // Track creation state
  const [newTrackValue, setNewTrackValue] = useState('');
  const [isAddingTrack, setIsAddingTrack] = useState(false);

  // Dragging State
  const [position, setPosition] = useState({ x, y });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });

  // Reset local state when selected node changes
  useEffect(() => {
    setLocalAttributes(node.attributes);
    setLocalContent(node.content || '');
    setIsAddingTrack(false);
    setNewTrackValue('');
    
    // Reset position when node changes (snaps back to default location)
    // We adjust y slightly up for edit mode to center it better
    setPosition({ x: x + 25, y: mode === 'edit' ? y - 100 : y + 25 });
  }, [node, mode, x, y]);

  // Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
      // Only allow dragging in edit mode
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

  const handleAttrChange = (key: string, valueStr: string) => {
    const parts = valueStr.split(',').map(s => s.trim()).filter(Boolean);
    setLocalAttributes(prev => ({
        ...prev,
        [key]: parts
    }));
  };

  const handleActiveTrackChange = (val: string) => {
      setLocalAttributes(prev => ({
          ...prev,
          [activeAttribute]: [val]
      }));
      setIsAddingTrack(false);
  };

  const submitNewTrack = () => {
      if (newTrackValue.trim()) {
          onCreateTrack(newTrackValue.trim());
          setLocalAttributes(prev => ({
              ...prev,
              [activeAttribute]: [newTrackValue.trim()]
          }));
          setIsAddingTrack(false);
          setNewTrackValue('');
      }
  };

  const handleDone = () => {
      onUpdateNode(node.id, {
          attributes: localAttributes,
          content: localContent
      });
      onClose();
  };

  const currentActiveVal = localAttributes[activeAttribute]?.[0] || '';
  const validRowLabels = rowLabels.filter(Boolean);

  // --- RENDER: PREVIEW MODE (Dark Tooltip - Not Draggable) ---
  if (mode === 'preview') {
      return (
        <div 
            className="absolute z-[60] pointer-events-none bg-slate-900/95 backdrop-blur text-white text-[10px] p-3 rounded-lg shadow-2xl flex flex-col gap-2 max-w-[240px] border border-slate-700 animate-in fade-in zoom-in-95 duration-150"
            style={{ left: position.x, top: position.y }}
        >
            <div className="flex justify-between items-center border-b border-white/20 pb-1">
                <span className="font-bold uppercase tracking-wider text-[#EDC948]">Fabula</span>
                <span className="text-[9px] text-slate-400 font-mono">Click to Edit</span>
            </div>
            <div className="text-white/90 text-xs italic leading-relaxed border-b border-white/10 pb-2">
                {node.content ? `"${node.content}"` : <span className="text-slate-500">(No statement)</span>}
            </div>
            <div className="flex flex-col gap-1">
                {Object.entries(node.attributes).map(([k, vals]) => (
                    <div key={k} className="flex gap-2 justify-between items-start">
                        <span className="text-slate-400 font-medium shrink-0">{k}:</span>
                        <span className="text-right text-white break-words">
                            {(vals as string[]).join(', ') || '-'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
      );
  }

  // --- RENDER: EDIT MODE (Interactive Card - Draggable) ---
  return (
    <div 
        className="absolute z-[70] w-80 bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-slate-900/5"
        style={{ left: position.x, top: position.y }}
        onClick={(e) => e.stopPropagation()}
    >
        {/* Header - Drag Handle */}
        <div 
            className="h-9 bg-slate-50/80 backdrop-blur border-b border-slate-200 flex items-center justify-between px-3 shrink-0 cursor-move active:cursor-grabbing select-none"
            onPointerDown={handlePointerDown}
        >
            <div className="flex items-center gap-2">
                <GripHorizontal className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Edit Node</span>
            </div>
            <button 
                onPointerDown={(e) => e.stopPropagation()} 
                onClick={onClose} 
                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto max-h-[400px]">
            
            {/* Source Info */}
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-400">Source Motif</label>
                <div className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">{node.motifSource || 'Manual'}</div>
            </div>

            {/* Content Input */}
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

            {/* Attributes Input */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-slate-800 block uppercase tracking-wide">Attributes</label>
                
                {availableAttributes.map(attr => {
                    const isActive = attr === activeAttribute;
                    const vals = localAttributes[attr] || [];
                    const valStr = vals.join(', ');

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

                            {isActive ? (
                                <div className="space-y-2">
                                    {!isAddingTrack ? (
                                        <Dropdown
                                            value={currentActiveVal}
                                            options={validRowLabels}
                                            onChange={handleActiveTrackChange}
                                            onAdd={() => setIsAddingTrack(true)}
                                            placeholder="Select Track..."
                                        />
                                    ) : (
                                        <div className="flex gap-1 animate-in fade-in slide-in-from-left-2 duration-150">
                                            <input 
                                                type="text" 
                                                autoFocus
                                                value={newTrackValue}
                                                onChange={e => setNewTrackValue(e.target.value)}
                                                placeholder="New Track Name"
                                                className="flex-1 text-xs px-2 py-1.5 border border-blue-300 ring-1 ring-blue-100 rounded focus:outline-none"
                                            />
                                            <button onClick={submitNewTrack} className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700 shrink-0">
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => setIsAddingTrack(false)} className="bg-slate-100 text-slate-500 p-1.5 rounded hover:bg-slate-200 shrink-0">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={valStr}
                                    onChange={(e) => handleAttrChange(attr, e.target.value)}
                                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-md focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100 transition-all text-slate-700 font-medium"
                                    placeholder="Value 1, Value 2..."
                                />
                            )}
                            {isActive && !isAddingTrack && (
                                <div className="flex items-center gap-1.5 text-[9px] text-slate-400 mt-0.5">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    <span>Changing this moves the node.</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="pt-2 flex gap-2">
                 <button 
                    onClick={() => {
                        if (window.confirm("Delete this node?")) {
                            onDelete();
                        }
                    }}
                    className="flex-1 bg-white border border-red-200 text-red-600 text-xs font-semibold py-2 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                </button>
                <button 
                    onClick={handleDone}
                    className="flex-[2] bg-slate-900 text-white text-xs font-semibold py-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-slate-200"
                >
                    <Check className="w-3.5 h-3.5" />
                    Save Changes
                </button>
            </div>
        </div>
    </div>
  );
};