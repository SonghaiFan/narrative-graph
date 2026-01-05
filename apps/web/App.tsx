
import React, { useState, useMemo } from 'react';
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
import { ChartNetwork, Columns, Rows, Plus, Minus, Sparkles } from 'lucide-react';
import { EdgeLayer } from './components/GraphVisual';
import { NarrativeNodeItem } from './components/NarrativeNodeItem';
import { AIGeneratorModal } from './components/AIGeneratorModal';
import { DAGView } from './components/DAGView';
import { ForceView } from './components/ForceView';
import { GraphProvider, useGraphContext } from './context/GraphContext';
import { generateGraphFromPrompt } from './services/ai';

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
    deleteNode
  } = useGraphContext();

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'dag' | 'cola' | 'cose'>('grid');

  // --- DnD State ---
  // DnD state remains in App/UI layer as it's transient
  const [draggedMotif, setDraggedMotif] = useState<Motif | null>(null);
  const [draggedNode, setDraggedNode] = useState<NarrativeNode | null>(null);
  const [hoverCell, setHoverCell] = useState<{ t: number, h: number } | null>(null);

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
      if (newRows > gridConfig.rows) adjustGrid('rows', newRows - gridConfig.rows);
      if (newCols > gridConfig.cols) adjustGrid('cols', newCols - gridConfig.cols);

      setGraphData(nodes, sources);
      setIsAIModalOpen(false);
    } catch (e: any) {
      console.error(e);
      alert(`Failed to generate graph: ${e.message || e}. Please check your API key or try a different prompt.`);
    } finally {
      setIsGeneratingAI(false);
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
            {/* AI Button */}
            <button
              onClick={() => setIsAIModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm shadow-indigo-200 transition-all font-medium text-xs animate-in fade-in"
            >
              <Sparkles className="w-3.5 h-3.5 fill-white/20" />
              AI Generate
            </button>

            <div className="w-px h-6 bg-slate-100"></div>

            {/* View Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('dag')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'dag' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                DAG
              </button>
              <button
                onClick={() => setViewMode('cola')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'cola' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Cola
              </button>
              <button
                onClick={() => setViewMode('cose')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'cose' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Cose
              </button>
            </div>

            <div className="w-px h-6 bg-slate-100"></div>

            <div className="flex items-center gap-4 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                <Columns className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-mono text-slate-500 w-4 font-bold">{gridConfig.cols}</span>
                <div className="flex gap-0.5">
                  <button onClick={() => adjustGrid('cols', -1)} className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-500"><Minus className="w-3 h-3" /></button>
                  <button onClick={() => adjustGrid('cols', 1)} className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-500"><Plus className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="w-px h-3 bg-slate-200"></div>
              <div className="flex items-center gap-2">
                <Rows className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-mono text-slate-500 w-4 font-bold">{gridConfig.rows}</span>
                <div className="flex gap-0.5">
                  <button onClick={() => adjustGrid('rows', -1)} className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-500"><Minus className="w-3 h-3" /></button>
                  <button onClick={() => adjustGrid('rows', 1)} className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-500"><Plus className="w-3 h-3" /></button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Track Panel */}
          <TrackPanel onImport={(file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const json = JSON.parse(e.target?.result as string);
                if (json.graph && Array.isArray(json.graph.nodes)) setGraphData(json.graph.nodes, json.graph.sources);
                else if (Array.isArray(json.nodes)) setGraphData(json.nodes, json.sources);
              } catch (err) { alert("Invalid file"); }
            };
            reader.readAsText(file);
          }} />

          {/* Center: Grid Workspace */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-100/50">
            {viewMode === 'grid' ? (
              <NarrativeGrid
                hoverCell={hoverCell}
                draggedMotif={draggedMotif}
                draggedNode={draggedNode}
              />
            ) : viewMode === 'dag' ? (
              <DAGView />
            ) : viewMode === 'cola' ? (
              <ForceView layoutType="cola" />
            ) : (
              <ForceView layoutType="cose" />
            )}
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
                  onClick={() => { }}
                  onHover={() => { }}
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
