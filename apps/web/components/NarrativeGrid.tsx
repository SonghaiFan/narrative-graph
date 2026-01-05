import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useDroppable } from "@dnd-kit/core";
import { NarrativeNode, Motif } from "../types";
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  LABEL_WIDTH,
  RIGHT_MARGIN,
  getTrackColor,
} from "../constants";
import { GridLattice } from "./GridLattice";
import { EdgeLayer, RenderedEdge } from "./GraphVisual";
import { NarrativeNodeItem } from "./NarrativeNodeItem";
import { GhostLayer } from "./GhostLayer";
import { GraphInspector } from "./GraphInspector";
import { useGraphContext } from "../context/GraphContext";

interface NarrativeGridProps {
  hoverCell: { t: number; h: number } | null;
  draggedMotif: Motif | null;
  draggedNode: NarrativeNode | null;
}

// Optimized Cell: Only renders a div to catch pointer events for Drop/Hover
const DroppableCell: React.FC<{
  t: number;
  h: number;
  onClick: () => void;
  onHover: (state: boolean) => void;
}> = React.memo(({ t, h, onClick, onHover }) => {
  const { setNodeRef } = useDroppable({
    id: `cell-${t}-${h}`,
    data: { t, h },
  });

  return (
    <div
      ref={setNodeRef}
      className="w-full h-full" // Transparent, strictly for interaction
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    />
  );
});

export const NarrativeGrid: React.FC<NarrativeGridProps> = ({
  hoverCell,
  draggedMotif,
  draggedNode,
}) => {
  const {
    graph,
    gridConfig,
    activeAttribute,
    visibleRowLabels,
    updateRowLabel,
    addManualNode,
    updateNode,
    deleteNode,
    availableAttributes,
    linkingAttribute,
    createTrack,
  } = useGraphContext();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const [internalHoverCell, setInternalHoverCell] = useState<{
    t: number;
    h: number;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const graphCardRef = useRef<HTMLDivElement>(null);

  // Viewport tracking for Portal positioning
  const [viewportOffset, setViewportOffset] = useState({ left: 0, top: 0 });

  // Calculate dynamic label width based on longest label
  const dynamicLabelWidth = useMemo(() => {
    if (visibleRowLabels.length === 0) return LABEL_WIDTH;

    // Create a canvas to measure text width
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return LABEL_WIDTH;

    // Match the label styling: text-sm (14px), font-bold
    context.font = "bold 14px system-ui, -apple-system, sans-serif";

    // Find the longest label
    const maxWidth = Math.max(
      ...visibleRowLabels.map((label) => {
        const text = label || "Track";
        return context.measureText(text).width;
      })
    );

    // Add padding: pl-6 (24px) + pr-6 (24px) + some extra buffer
    const padding = 24 + 24 + 16; // left + right + buffer
    return Math.max(maxWidth + padding, LABEL_WIDTH); // Ensure minimum width
  }, [visibleRowLabels]);

  const updateViewportOffset = useCallback(() => {
    if (graphCardRef.current) {
      const rect = graphCardRef.current.getBoundingClientRect();
      setViewportOffset({ left: rect.left, top: rect.top });
    }
  }, []);

  useEffect(() => {
    const scroller = scrollContainerRef.current;
    if (scroller) {
      scroller.addEventListener("scroll", updateViewportOffset);
      window.addEventListener("resize", updateViewportOffset);
      // Initial measurement
      updateViewportOffset();

      // Also measure after a slight delay to ensure layout settling
      const timer = setTimeout(updateViewportOffset, 100);

      return () => {
        scroller.removeEventListener("scroll", updateViewportOffset);
        window.removeEventListener("resize", updateViewportOffset);
        clearTimeout(timer);
      };
    }
  }, [updateViewportOffset, gridConfig.rows, gridConfig.cols]);

  // Deselect if item removed
  useEffect(() => {
    if (selectedNodeId && !graph.nodes.find((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
    if (selectedEdgeId && !graph.edges.find((e) => e.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
    }
  }, [graph.nodes, graph.edges, selectedNodeId, selectedEdgeId]);

  // Keyboard deletion support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNodeId) {
        if (document.activeElement === document.body) {
          deleteNode(selectedNodeId);
          setSelectedNodeId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, deleteNode]);

  const visibleNodes = useMemo(() => {
    return graph.nodes.filter(
      (n) =>
        n.time < gridConfig.cols && n.track < gridConfig.rows && n.track >= 0
    );
  }, [graph.nodes, gridConfig]);

  const nodesByCell = useMemo(() => {
    const map = new Map<string, NarrativeNode[]>();
    visibleNodes.forEach((n) => {
      const key = `${n.time}-${n.track}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    });
    return map;
  }, [visibleNodes]);

  const nodeLabels = useMemo(() => {
    // Use the persistent label from the node itself
    return new Map(graph.nodes.map((n) => [n.id, n.label || '']));
  }, [graph.nodes]);

  const renderedEdges: RenderedEdge[] = useMemo(() => {
    return graph.edges
      .map((e) => {
        const s = visibleNodes.find((n) => n.id === e.sourceId);
        const t = visibleNodes.find((n) => n.id === e.targetId);
        if (!s || !t) return null;
        return {
          id: e.id,
          source: { x: s.time, y: s.track },
          target: { x: t.time, y: t.track },
          isActive: e.id === selectedEdgeId,
          isGhost: false,
        };
      })
      .filter(Boolean) as RenderedEdge[];
  }, [graph.edges, visibleNodes, selectedEdgeId]);

  // --- INSPECTOR LOGIC ---
  const activeNode =
    selectedNodeId || hoveredNodeId
      ? visibleNodes.find((n) => n.id === (selectedNodeId || hoveredNodeId))
      : null;
  const activeEdge = selectedEdgeId
    ? graph.edges.find((e) => e.id === selectedEdgeId)
    : null;

  const activeCluster = activeNode
    ? nodesByCell.get(`${activeNode.time}-${activeNode.track}`) || [activeNode]
    : [];

  let inspectorType: "node" | "edge" | null = null;
  let inspectorData: any = null;
  let inspectorMode: "preview" | "edit" = "preview";
  let inspectorCoords = { x: 0, y: 0 };

  if (activeNode && !draggedNode) {
    inspectorType = "node";
    inspectorData = activeNode;
    inspectorMode = selectedNodeId ? "edit" : "preview";
    const relativeX =
      dynamicLabelWidth + activeNode.time * CELL_WIDTH + CELL_WIDTH / 2;
    const relativeY = activeNode.track * CELL_HEIGHT + CELL_HEIGHT / 2;
    inspectorCoords = {
      x: viewportOffset.left + relativeX,
      y: viewportOffset.top + relativeY,
    };
  } else if (activeEdge && !draggedNode) {
    inspectorType = "edge";
    inspectorData = activeEdge;
    inspectorMode = "edit";
    const s = visibleNodes.find((n) => n.id === activeEdge.sourceId);
    const t = visibleNodes.find((n) => n.id === activeEdge.targetId);
    if (s && t) {
      const x1 = dynamicLabelWidth + s.time * CELL_WIDTH + CELL_WIDTH / 2;
      const y1 = s.track * CELL_HEIGHT + CELL_HEIGHT / 2;
      const x2 = dynamicLabelWidth + t.time * CELL_WIDTH + CELL_WIDTH / 2;
      const y2 = t.track * CELL_HEIGHT + CELL_HEIGHT / 2;
      inspectorCoords = {
        x: viewportOffset.left + (x1 + x2) / 2,
        y: viewportOffset.top + (y1 + y2) / 2,
      };
    }
  }

  const totalWidth =
    dynamicLabelWidth + gridConfig.cols * CELL_WIDTH + RIGHT_MARGIN;
  // Use gridConfig.rows which is now strictly synced to visibleRowLabels length
  const totalHeight = gridConfig.rows * CELL_HEIGHT;

  const isDragging = !!draggedMotif || !!draggedNode;
  const activeHoverCell = isDragging ? hoverCell : internalHoverCell;

  return (
    <div
      className="flex flex-col h-full w-full bg-slate-50/50"
      onClick={() => {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
      }}
    >
      <div ref={scrollContainerRef} className="flex-1 overflow-auto relative">
        <div className="min-h-full min-w-fit px-12 pb-12 pt-16 flex flex-col items-center justify-center bg-slate-50/50">
          <div id="narrative-export-root" className="flex flex-col items-center p-4">
            {/* Legend Bar */}
            <div className="mb-6 flex items-center gap-6 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full shadow-sm px-6 py-2 z-50">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mr-2">
                Legend
              </div>
              <div className="flex items-center gap-6 text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-slate-800">Organising (α):</span>
                    <span>Tracks ordered by <span className="font-semibold text-slate-800">{activeAttribute}</span></span>
                  </div>
                </div>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-2">
                  <div className="relative w-7 h-3">
                    <div className="absolute left-0 top-1.5 right-0 h-0.5 bg-slate-700 rounded" />
                    <div className="absolute right-0 top-[2px] border-l-[7px] border-l-slate-700 border-y-[5px] border-y-transparent" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-slate-800">Linking (β):</span>
                    <span>Edges connect shared <span className="font-semibold text-slate-800">{linkingAttribute}</span></span>
                  </div>
                </div>
              </div>
            </div>

            <div
              ref={graphCardRef}
              id="narrative-graph-card"
              className="relative shadow-sm bg-white rounded-xl border border-slate-200 transition-all duration-300 ease-out"
              style={{ width: totalWidth, height: Math.max(totalHeight, 100) }} // Ensure min height if 0 rows
            >

              {/* Empty State Prompt */}
              {gridConfig.rows === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm font-medium">
                  No tracks visible. Add or unhide tracks to continue.
                </div>
              )}

              {/* Layer 0: Track Backgrounds - Render based on Visible Labels */}
              {visibleRowLabels.map((label, h) => (
                <div
                  key={`track-bg-${h}`}
                  className="absolute rounded-full"
                  style={{
                    left: dynamicLabelWidth,
                    width: gridConfig.cols * CELL_WIDTH + RIGHT_MARGIN - 20,
                    top: h * CELL_HEIGHT + 10,
                    height: CELL_HEIGHT - 20,
                    zIndex: 0,
                    backgroundColor: "#FAFAFA",
                    border: "1px dashed #E2E8F0",
                  }}
                />
              ))}

              {/* Layer 0.5: Dot Grid (Dot Paper effect) */}
              <div className="absolute inset-0 pointer-events-none z-0">
                <svg width={totalWidth} height={Math.max(totalHeight, 100)}>
                  {Array.from({ length: gridConfig.rows }).map((_, h) =>
                    Array.from({ length: gridConfig.cols }).map((_, t) => (
                      <circle
                        key={`dot-${t}-${h}`}
                        cx={dynamicLabelWidth + t * CELL_WIDTH + CELL_WIDTH / 2}
                        cy={h * CELL_HEIGHT + CELL_HEIGHT / 2}
                        r={2}
                        fill="#CBD5E1"
                      />
                    ))
                  )}
                </svg>
              </div>

              {/* Layer 1: Lattice */}
              {isDragging && gridConfig.rows > 0 && (
                <div className="absolute inset-0 pointer-events-none z-10 opacity-60">
                  <GridLattice
                    rows={gridConfig.rows}
                    cols={gridConfig.cols}
                    cellWidth={CELL_WIDTH}
                    cellHeight={CELL_HEIGHT}
                    labelWidth={dynamicLabelWidth}
                  />
                </div>
              )}

              {/* Layer 2: Edges */}
              <div className="absolute inset-0 z-20 pointer-events-none">
                <EdgeLayer
                  edges={renderedEdges}
                  width={totalWidth}
                  height={totalHeight}
                  offsetX={dynamicLabelWidth}
                  offsetY={0}
                  interactive={true}
                  onEdgeClick={(id, e) => {
                    setSelectedEdgeId(id);
                    setSelectedNodeId(null);
                  }}
                />
              </div>

              {/* Layer 3: Ghost/Preview */}
              {gridConfig.rows > 0 && (
                <GhostLayer
                  graph={graph}
                  draggedMotif={draggedMotif}
                  draggedNode={draggedNode}
                  hoverCell={activeHoverCell}
                  gridRows={gridConfig.rows}
                  gridCols={gridConfig.cols}
                  offsetX={dynamicLabelWidth}
                  visibleRowLabels={visibleRowLabels}
                />
              )}

              {/* Layer 4: Real Nodes */}
              <div className="absolute inset-0 z-40 pointer-events-none">
                {Array.from(nodesByCell.entries()).map(([key, group]) => {
                  if (group.length === 0) return null;
                  const primaryNode = group[0];
                  return (
                    <NarrativeNodeItem
                      key={key}
                      node={primaryNode}
                      count={group.length}
                      label={nodeLabels.get(primaryNode.id)}
                      isSelected={group.some((n) => n.id === selectedNodeId)}
                      isHovered={group.some((n) => n.id === hoveredNodeId)}
                      color={getTrackColor(visibleRowLabels[primaryNode.track])}
                      offsetX={dynamicLabelWidth}
                      offsetY={0}
                      onClick={() => {
                        setSelectedNodeId(primaryNode.id);
                        setSelectedEdgeId(null);
                      }}
                      onHover={(state) =>
                        setHoveredNodeId(state ? primaryNode.id : null)
                      }
                    />
                  );
                })}
              </div>

              {/* Layer 5: Interaction Grid - Synced to Visible Labels */}
              {visibleRowLabels.map((label, h) => (
                <div
                  key={`row-${h}`}
                  className="flex items-center relative z-10"
                  style={{ height: CELL_HEIGHT }}
                >
                  {/* Row Label Input */}
                  <div
                    style={{ width: dynamicLabelWidth }}
                    className="shrink-0 pr-6 pl-6 flex items-center justify-end h-full pointer-events-auto"
                  >
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => updateRowLabel(h, e.target.value)}
                      placeholder={`Track ${h + 1}`}
                      className="text-right font-bold text-slate-600 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-none w-full px-1 py-1 transition-all placeholder:text-slate-300 placeholder:font-normal text-sm"
                    />
                  </div>

                  {/* Cell Grid */}
                  <div className="flex">
                    {Array.from({ length: gridConfig.cols }).map((_, t) => (
                      <div
                        key={`${t}-${h}`}
                        style={{ width: CELL_WIDTH, height: CELL_HEIGHT }}
                        className="relative"
                      >
                        <DroppableCell
                          t={t}
                          h={h}
                          onClick={() => addManualNode(t, h)}
                          onHover={(isHovering) => {
                            if (isHovering) setInternalHoverCell({ t, h });
                            else if (
                              internalHoverCell?.t === t &&
                              internalHoverCell?.h === h
                            )
                              setInternalHoverCell(null);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            </div>
            {/* --- Time Axis --- */}
            <div
              className="pointer-events-none"
              style={{
                width: totalWidth,
                marginTop: "10px",
              }}
            >
              <div style={{ marginLeft: dynamicLabelWidth, width: gridConfig.cols * CELL_WIDTH }}>
                <div className="flex">
                  {Array.from({ length: gridConfig.cols }).map((_, t) => {
                    const nodesInCol = graph.nodes.filter((n) => n.time === t);
                    const timePeriod = nodesInCol
                      .map((n) => n.attributes["Time Period"]?.[0])
                      .find(Boolean);
                    const date = nodesInCol
                      .map((n) => n.attributes["Date"]?.[0])
                      .find(Boolean);
                    const label = timePeriod || date || `t${t}`;

                    return (
                      <div
                        key={`time-${t}`}
                        style={{ width: CELL_WIDTH }}
                        className="flex flex-col items-center"
                      >
                        <div className="h-2 w-px bg-slate-300 mb-2"></div>
                        <span
                          className="text-[10px] font-mono font-bold text-slate-400 text-center w-full px-1 truncate block"
                          title={label}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="text-center font-bold text-slate-300 uppercase tracking-[0.2em] text-[10px] mt-4">
                  Time (T)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* UNIFIED GRAPH INSPECTOR */}
      {inspectorType && inspectorData && (
        <GraphInspector
          type={inspectorType}
          data={inspectorData}
          clusterNodes={inspectorType === "node" ? activeCluster : undefined}
          graph={graph}
          mode={inspectorMode}
          x={inspectorCoords.x}
          y={inspectorCoords.y}
          onClose={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
          }}
          onUpdateNode={updateNode}
          onSelectNode={setSelectedNodeId}
          onDeleteNode={
            inspectorType === "node"
              ? (id) => {
                deleteNode(id);
                setSelectedNodeId(null);
              }
              : undefined
          }
          activeAttribute={activeAttribute}
          linkingAttribute={linkingAttribute}
          availableAttributes={availableAttributes}
          rowLabels={visibleRowLabels}
          onCreateTrack={createTrack}
        />
      )}
    </div>
  );
};
