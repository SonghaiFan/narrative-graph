import React, { useRef } from 'react';
import { Settings2, Upload, Trash2, Image as ImageIcon, PenTool, FileJson } from 'lucide-react';
import { Dropdown } from './Dropdown';
import { useGraphContext } from '../context/GraphContext';
import { TEMPORAL_KEYS } from '../constants';
import { toPng, toSvg } from 'html-to-image';
import { buildGraphFile } from '../utils/graphFile';

interface TrackPanelProps {
    onImport: (file: File) => void;
}

export const TrackPanel: React.FC<TrackPanelProps> = ({ onImport }) => {
    const {
        activeAttribute,
        setActiveAttribute,
        availableAttributes,
        addAttribute,
        deleteAttribute,
        linkingAttribute,
        setLinkingAttribute,
        clearGraph,
        graph,
        gridConfig
    } = useGraphContext();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const nonTemporalAttributes = availableAttributes.filter(attr => !TEMPORAL_KEYS.includes(attr));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onImport(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleExportJSON = () => {
        // Edges are left out of the file because they are derived from rules
        const exportObject = buildGraphFile(graph, { rows: gridConfig.rows, cols: gridConfig.cols });
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

            <div className="flex-1 px-5 py-4 text-xs text-slate-400 leading-relaxed bg-white">
                Tracks are edited beside the graph: hover a track name to drag, hide or delete it.
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