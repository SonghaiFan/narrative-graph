import React from 'react';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, GripVertical, Trash2 } from 'lucide-react';
import { CELL_HEIGHT } from '../constants';

interface TrackLabelColumnProps {
    labels: string[];
    width: number;
    onRename: (index: number, value: string) => void;
    onReorder: (from: number, to: number) => void;
    onHide: (label: string) => void;
    onDelete: (label: string) => void;
}

interface RowProps {
    id: string;
    index: number;
    label: string;
    onRename: (index: number, value: string) => void;
    onHide: (label: string) => void;
    onDelete: (label: string) => void;
}

const TrackLabelRow: React.FC<RowProps> = ({ id, index, label, onRename, onHide, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    // A track with no name yet cannot be hidden or deleted by name.
    const named = label !== '';

    return (
        <div
            ref={setNodeRef}
            style={{
                height: CELL_HEIGHT,
                transform: CSS.Translate.toString(transform),
                transition,
                zIndex: isDragging ? 50 : undefined,
                position: 'relative',
            }}
            className={`group flex items-center pl-2 pr-6 ${isDragging ? 'opacity-80' : ''}`}
        >
            <div className={`flex items-center gap-0.5 mr-1 transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
                <div
                    {...attributes}
                    {...listeners}
                    // Stops the editor's own drag-and-drop from taking the gesture
                    onPointerDown={(e) => { e.stopPropagation(); listeners?.onPointerDown?.(e); }}
                    className="cursor-grab active:cursor-grabbing p-1 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 outline-none touch-none"
                    title="Drag to reorder"
                >
                    <GripVertical className="w-3.5 h-3.5" />
                </div>
                <button
                    onClick={() => onHide(label)}
                    disabled={!named}
                    className="p-1 rounded-full text-blue-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Hide track"
                >
                    <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={() => onDelete(label)}
                    disabled={!named}
                    className="p-1 rounded-full text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Delete track"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
            <input
                type="text"
                value={label}
                onChange={(e) => onRename(index, e.target.value)}
                placeholder={`Track ${index + 1}`}
                className="text-right font-bold text-slate-600 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none flex-1 min-w-0 px-1 py-1 transition-all placeholder:text-slate-300 placeholder:font-normal text-sm"
            />
        </div>
    );
};

/** The track names down the left of the graph, with the controls to move, hide and delete each track. */
export const TrackLabelColumn: React.FC<TrackLabelColumnProps> = ({ labels, width, onRename, onReorder, onHide, onDelete }) => {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );
    const ids = labels.map((_, i) => `track-row-${i}`);

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        onReorder(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    };

    return (
        <div className="absolute left-0 top-0 z-20" style={{ width }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    {labels.map((label, i) => (
                        <TrackLabelRow key={ids[i]} id={ids[i]} index={i} label={label} onRename={onRename} onHide={onHide} onDelete={onDelete} />
                    ))}
                </SortableContext>
            </DndContext>
        </div>
    );
};
