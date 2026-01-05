import React, { useRef } from 'react';
import { Layers, Eye, EyeOff, Settings2, Upload, Download, Trash2, GripVertical, Image as ImageIcon, PenTool, FileJson } from 'lucide-react';
import { Dropdown } from './Dropdown';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors, KeyboardSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useGraphContext } from '../context/GraphContext';
import { TEMPORAL_KEYS, getTrackColor } from '../constants';
import { toPng, toSvg } from 'html-to-image';

interface TrackPanelProps {
    onImport: (file: File) => void;
}

interface SortableTrackItemProps {
    label: string;
    isHidden: boolean;
    onToggle: (l: string) => void;
    onDelete: (l: string) => void;
}

const SortableTrackItem: React.FC<SortableTrackItemProps> = ({ label, isHidden, onToggle, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: label });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as 'relative'
    };

    // Wrapper to stop propagation prevents parent DnD context from hijacking the event
    const handlePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        listeners?.onPointerDown?.(e);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
                flex items-center justify-between p-2 rounded-lg border mb-2 select-none touch-none
                ${isHidden ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-white border-slate-200 shadow-sm'}
                ${isDragging ? 'shadow-lg opacity-80 ring-1 ring-blue-400 border-blue-400 z-50' : 'hover:border-slate-300'}
            `}
        >
            <div className="flex items-center gap-2 overflow-hidden flex-1">
                <div
                    {...attributes}
                    {...listeners}
                    onPointerDown={handlePointerDown}
                    className="cursor-grab hover:text-slate-600 text-slate-300 flex-shrink-0 p-1 hover:bg-slate-100 rounded transition-colors active:cursor-grabbing outline-none"
                >
                    <GripVertical className="w-4 h-4" />
                </div>
                <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getTrackColor(label) }}
                />
                <span
                    onClick={() => onToggle(label)}
                    className={`text-sm font-medium truncate cursor-pointer flex-1 ${isHidden ? 'line-through decoration-slate-300' : 'text-slate-700'}`}
                >
                    {label}
                </span>
            </div>
            <div className="flex items-center gap-1">
                <button
                    onClick={(e) => { e.stopPropagation(); onToggle(label); }}
                    className={`p-1 rounded-full hover:bg-slate-100 ${isHidden ? 'text-slate-400' : 'text-blue-500'}`}
                    title={isHidden ? "Show Track" : "Hide Track"}
                >
                    {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(label); }}
                    className="p-1 rounded-full hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                    title="Delete Track"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

export const TrackPanel: React.FC<TrackPanelProps> = ({ onImport }) => {
    const {
        activeAttribute,
        setActiveAttribute,
        availableAttributes,
        addAttribute,
        deleteAttribute,
        linkingAttribute,
        setLinkingAttribute,
        rowLabelMap,
        hiddenLabels,
        toggleTrackVisibility,
        deleteTrack,
        reorderTracks,
        clearGraph,
        graph,
        gridConfig
    } = useGraphContext();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter unique labels for display
    const currentLabels = rowLabelMap[activeAttribute] || [];
    // Ensure uniqueness and filter out empties for stable IDs
    const uniqueLabels = React.useMemo(() => {
        return Array.from(new Set(currentLabels.filter(Boolean)));
    }, [currentLabels]);

    const nonTemporalAttributes = availableAttributes.filter(attr => !TEMPORAL_KEYS.includes(attr));

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = uniqueLabels.indexOf(active.id as string);
            const newIndex = uniqueLabels.indexOf(over.id as string);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrder = arrayMove(uniqueLabels, oldIndex, newIndex);
                reorderTracks(newOrder);
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onImport(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleExportJSON = () => {
        const exportObject = {
            graph: graph,
            layout: { rows: gridConfig.rows, cols: gridConfig.cols },
            metadata: { timestamp: new Date().toISOString(), version: '1.0' }
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "narrative_graph.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleExportImage = async (format: 'png' | 'svg') => {
        const node = document.getElementById('narrative-export-root') ||
            document.getElementById('narrative-graph-card') ||
            document.getElementById('dag-view-root') ||
            document.getElementById('force-view-root');

        if (!node) {
            alert("Could not find graph element to export.");
            return;
        }

        try {
            const dataUrl = format === 'png'
                ? await toPng(node, { backgroundColor: '#ffffff', pixelRatio: 2 })
                : await toSvg(node, { backgroundColor: '#ffffff' });

            const link = document.createElement('a');
            link.download = `narrative-graph.${format}`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Export failed', err);
            alert('Failed to export image.');
        }
    };

    return (
        <div className="w-80 bg-white border-r border-slate-200 h-full flex flex-col shadow-xl z-20 shrink-0">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />

            <div className="px-5 py-5 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-2 mb-1">
                    <Settings2 className="w-4 h-4 text-slate-800" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Configuration</span>
                </div>
                <h2 className="font-serif text-lg font-bold text-slate-900">Graph Settings</h2>
            </div>

            <div className="p-5 border-b border-slate-200 bg-slate-50/50 space-y-4">
                <Dropdown
                    label="Organising Axis (&alpha;)"
                    value={activeAttribute}
                    options={nonTemporalAttributes}
                    onChange={setActiveAttribute}
                    onAdd={() => {
                        const name = prompt("Enter new attribute name:");
                        if (name) addAttribute(name);
                    }}
                    onDelete={deleteAttribute}
                    className="w-full"
                />
                <Dropdown
                    label="Linking Rule (&beta;)"
                    value={linkingAttribute}
                    options={nonTemporalAttributes}
                    onChange={setLinkingAttribute}
                    className="w-full"
                />
            </div>

            <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tracks</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                    {uniqueLabels.length}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-white scrollbar-thin scrollbar-thumb-slate-200">
                {uniqueLabels.length === 0 ? (
                    <div className="text-center p-4 text-slate-400 italic text-xs">
                        No tracks defined. Add nodes to create tracks.
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={uniqueLabels} strategy={verticalListSortingStrategy}>
                            {uniqueLabels.map(label => (
                                <SortableTrackItem
                                    key={label}
                                    label={label}
                                    isHidden={hiddenLabels.includes(label)}
                                    onToggle={toggleTrackVisibility}
                                    onDelete={deleteTrack}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 text-xs text-slate-600 hover:text-slate-900 font-medium px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
                        <Upload className="w-3.5 h-3.5" /> Import
                    </button>
                    <button onClick={handleExportJSON} className="flex items-center justify-center gap-2 text-xs text-slate-600 hover:text-slate-900 font-medium px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
                        <FileJson className="w-3.5 h-3.5" /> JSON
                    </button>
                </div>

                <div className="h-px bg-slate-200 w-full"></div>

                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleExportImage('png')} className="flex items-center justify-center gap-2 text-xs text-slate-600 hover:text-slate-900 font-medium px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
                        <ImageIcon className="w-3.5 h-3.5" /> PNG
                    </button>
                    <button onClick={() => handleExportImage('svg')} className="flex items-center justify-center gap-2 text-xs text-slate-600 hover:text-slate-900 font-medium px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
                        <PenTool className="w-3.5 h-3.5" /> SVG
                    </button>
                </div>

                <button onClick={clearGraph} className="flex items-center justify-center gap-2 text-xs text-red-600 hover:text-red-700 font-medium px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 border border-transparent transition-all mt-1">
                    <Trash2 className="w-3.5 h-3.5" /> Clear All Data
                </button>
            </div>
        </div>
    );
};