
import React, { useState, useMemo, useRef } from 'react';
import { 
    DndContext, 
    DragOverlay, 
    useSensor, 
    useSensors, 
    PointerSensor, 
    DragStartEvent, 
    DragOverEvent, 
    DragEndEvent,
    pointerWithin
} from '@dnd-kit/core';
import { MotifPanel } from './components/MotifPanel';
import { NarrativeGrid } from './components/NarrativeGrid';
import { StorySidebar } from './components/StorySidebar'; 
import { TrackPanel } from './components/TrackPanel';
import { NarrativeNode, Motif } from './types';
import { CELL_WIDTH, CELL_HEIGHT } from './constants';
import { ChartNetwork, Sparkles, Save, Download, Upload, Trash2 } from 'lucide-react';
import { EdgeLayer } from './components/GraphVisual';
import { NarrativeNodeItem } from './components/NarrativeNodeItem';
import { AIGeneratorModal } from './components/AIGeneratorModal';
import { generateGraphFromPrompt } from './services/ai';
import { GraphProvider, useGraphContext } from './context/GraphContext';
import { exportGraphAsJSON, exportGraphAsPNG, exportGraphAsSVG } from './services/export';

const AppContent: React.FC = () => {
  const { 
      graph, 
      gridConfig, 
      adjustGrid,
      addMotifToGraph,
      moveNode,
      setGraphData,
      availableAttributes,
      activeAttribute,
      linkingAttribute,
      rowLabelMap,
      visibleRowLabels,
      deleteNode,
      clearGraph
  } = useGraphContext();
  
  const gridRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // --- DnD State ---
  // DnD state remains in App/UI layer as it's transient
  const [draggedMotif, setDraggedMotif] = useState<Motif | null>(null);
  const [draggedNode, setDraggedNode] = useState<NarrativeNode | null>(null);
  const [hoverCell, setHoverCell] = useState<{t: number, h: number} | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    if (data?.motif) setDraggedMotif(data.motif);
    else if (data?.type === 'NODE' && data.node) setDraggedNode(data.node);
  };

  const handleDragOver = (event: DragOverEvent) => {
      const { over } = event;
      if (over && over.data.current) {
          const { t, h } = over.data.current;
          if (hoverCell?.t !== t || hoverCell?.h !== h) setHoverCell({ t, h });
      } else {
          setHoverCell(null);
      }
  };

  const handleDragEnd = (event: DragEndEvent) => {
      const { over } = event;
      if (over && over.data.current) {
          const { t, h } = over.data.current;
          if (draggedMotif) addMotifToGraph(draggedMotif, t, h);
          else if (draggedNode) moveNode(draggedNode.id, t, h);
      } else {
          // If dropped outside of any valid cell (the "space"), delete the node
          if (draggedNode) {
              deleteNode(draggedNode.id);
          }
      }
      setDraggedMotif(null);
      setDraggedNode(null);
      setHoverCell(null);
  };

  const handleAIGenerate = async (prompt: string, useSearch: boolean) => {
    setIsGeneratingAI(true);
    try {
        const { nodes, sources, recommendedRows, recommendedCols } = await generateGraphFromPrompt(
            prompt, 
            availableAttributes,
            gridConfig.rows, 
            gridConfig.cols,
            useSearch
        );
        
        // Adjust grid if needed
        const newRows = Math.max(gridConfig.rows, recommendedRows);
        const newCols = Math.max(gridConfig.cols, recommendedCols);
        
        // This could be optimized to batch updates
        if(newRows > gridConfig.rows) adjustGrid('rows', newRows - gridConfig.rows);
        if(newCols > gridConfig.cols) adjustGrid('cols', newCols - gridConfig.cols);
        
        setGraphData(nodes, sources);
        setIsAIModalOpen(false);
    } catch (e) {
        console.error(e);
        alert("Failed to generate graph. Please check your API key or try a different prompt.");
    } finally {
        setIsGeneratingAI(false);
    }
  };

  const handleSaveGraph = () => {
    const exportData = {
      graph,
      gridConfig,
      availableAttributes,
      activeAttribute,
      linkingAttribute,
      rowLabelMap,
      visibleRowLabels,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    exportGraphAsJSON(exportData);
  };

  const handleExportAsPNG = async () => {
    if (!gridRef.current) {
      alert('Graph element not found');
      return;
    }
    
    // Find the actual graph card element
    const graphCard = gridRef.current.querySelector('.relative.shadow-sm.bg-white.rounded-xl') as HTMLElement;
    if (!graphCard) {
      alert('Graph card not found');
      return;
    }
    
    try {
      await exportGraphAsPNG(graphCard);
    } catch (error: any) {
      console.error('PNG export failed:', error);
      const errorMessage = error?.message || 'PNG export failed';
      if (errorMessage.includes('html2canvas')) {
        // Offer to use SVG instead
        if (confirm('PNG export requires html2canvas. Would you like to export as SVG instead?\n\nTo enable PNG export, run: npm install html2canvas')) {
          exportGraphAsSVG(graphCard);
        }
      } else {
        alert(`Export failed: ${errorMessage}`);
      }
    }
  };

  const handleExportAsSVG = () => {
    if (!gridRef.current) {
      alert('Graph element not found');
      return;
    }
    
    const graphCard = gridRef.current.querySelector('.relative.shadow-sm.bg-white.rounded-xl') as HTMLElement;
    if (!graphCard) {
      alert('Graph card not found');
      return;
    }
    
    exportGraphAsSVG(graphCard);
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.graph && Array.isArray(json.graph.nodes)) {
          setGraphData(json.graph.nodes, json.graph.sources);
        } else if (Array.isArray(json.nodes)) {
          setGraphData(json.nodes, json.sources);
        } else {
          alert('Invalid file format. Expected graph data with nodes array.');
        }
      } catch (err) {
        alert('Failed to parse file. Please check the file format.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImport(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearGraph = () => {
    if (confirm('Are you sure you want to clear all graph data? This action cannot be undone.')) {
      clearGraph();
    }
  };

  const dragOverlayData = useMemo(() => {
    if (draggedMotif) {
        const nodes = draggedMotif.nodes.map((n, i) => ({
            id: `drag-${i}`,
            time: n.relTime,
            track: n.relTrack,
            attributes: {},
            content: ''
        }));
        
        const edges = draggedMotif.edges.map((e, i) => ({
            id: `drag-edge-${i}`,
            source: { x: draggedMotif.nodes[e.sourceIndex].relTime, y: draggedMotif.nodes[e.sourceIndex].relTrack },
            target: { x: draggedMotif.nodes[e.targetIndex].relTime, y: draggedMotif.nodes[e.targetIndex].relTrack },
        }));
        
        const maxTime = Math.max(...draggedMotif.nodes.map(n => n.relTime));
        const maxTrack = Math.max(...draggedMotif.nodes.map(n => n.relTrack));
        const width = (maxTime + 1) * CELL_WIDTH;
        const height = (maxTrack + 1) * CELL_HEIGHT;
        
        return { nodes, edges, width, height };
    } else if (draggedNode) {
        return {
            nodes: [{ ...draggedNode, time: 0, track: 0 }],
            edges: [],
            width: CELL_WIDTH,
            height: CELL_HEIGHT
        };
    }
    return null;
  }, [draggedMotif, draggedNode]);

  return (
    <DndContext 
        sensors={sensors}
        collisionDetection={pointerWithin} 
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
    >
        <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
        
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm z-30 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-slate-900 text-white p-2 rounded-lg">
                        <ChartNetwork className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold serif text-slate-800 tracking-tight leading-none">TTNG Constructor</h1>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 font-medium">Time-Track Narrative Graph</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Import Button */}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept=".json" 
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all font-medium text-xs"
                        title="Import graph from JSON"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        Import
                    </button>

                    {/* Save Button */}
                    <button
                        onClick={handleSaveGraph}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all font-medium text-xs"
                        title="Save graph as JSON"
                    >
                        <Save className="w-3.5 h-3.5" />
                        Save
                    </button>

                    {/* Export as Image Button */}
                    <div className="relative">
                        <button
                            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all font-medium text-xs"
                            title="Export graph as image"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export
                        </button>
                        {/* Dropdown menu for export options */}
                        {isExportMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[140px]">
                                <button
                                    onClick={() => {
                                        setIsExportMenuOpen(false);
                                        handleExportAsPNG();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 rounded-t-lg transition-colors"
                                >
                                    Export as PNG
                                </button>
                                <button
                                    onClick={() => {
                                        setIsExportMenuOpen(false);
                                        handleExportAsSVG();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 rounded-b-lg transition-colors"
                                >
                                    Export as SVG
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="w-px h-6 bg-slate-100"></div>

                    {/* AI Button */}
                    <button
                        onClick={() => setIsAIModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm shadow-indigo-200 transition-all font-medium text-xs animate-in fade-in"
                    >
                        <Sparkles className="w-3.5 h-3.5 fill-white/20" />
                        AI Generate
                    </button>

                    <div className="w-px h-6 bg-slate-100"></div>

                    {/* Clear Button */}
                    <button
                        onClick={handleClearGraph}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-lg transition-all font-medium text-xs"
                        title="Clear all graph data"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear
                    </button>

                </div>
        </header>

        {/* Click outside to close export menu */}
        {isExportMenuOpen && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsExportMenuOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
            {/* Left: Track Panel */}
            <TrackPanel />

            {/* Center: Grid Workspace */}
            <div ref={gridRef} className="flex-1 flex flex-col min-w-0 bg-slate-100/50">
                 <NarrativeGrid 
                    hoverCell={hoverCell}
                    draggedMotif={draggedMotif}
                    draggedNode={draggedNode}
                />
            </div>

            {/* Right: Story Sidebar */}
            <StorySidebar />
        </div>

        {/* Bottom: Motif Panel */}
        <MotifPanel />

        {/* AI Modal */}
        <AIGeneratorModal 
            isOpen={isAIModalOpen}
            onClose={() => setIsAIModalOpen(false)}
            onGenerate={handleAIGenerate}
            isGenerating={isGeneratingAI}
        />

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={null} zIndex={100}>
            {dragOverlayData ? (
                <div 
                    className="relative cursor-grabbing opacity-80 pointer-events-none"
                    style={{ 
                        width: dragOverlayData.width, 
                        height: dragOverlayData.height,
                    }}
                >
                    <EdgeLayer
                        edges={dragOverlayData.edges}
                        width={dragOverlayData.width}
                        height={dragOverlayData.height}
                        offsetX={0}
                        offsetY={0}
                        interactive={false}
                    />
                    {dragOverlayData.nodes.map(node => (
                         <NarrativeNodeItem
                            key={node.id}
                            node={node as NarrativeNode}
                            isSelected={true}
                            isHovered={false}
                            isGhost={false}
                            isOverlay={true}
                            color="#ffffff" 
                            offsetX={0}
                            offsetY={0}
                            onClick={() => {}}
                            onHover={() => {}}
                         />
                    ))}
                </div>
            ) : null}
        </DragOverlay>
        </div>
    </DndContext>
  );
};

const App: React.FC = () => {
    return (
        <GraphProvider>
            <AppContent />
        </GraphProvider>
    );
};

export default App;
