import React, { useEffect, useRef, useMemo, useState } from 'react';
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import { useGraphContext } from '../context/GraphContext';
import { getTrackColor, NODE_DIAMETER } from '../constants';
import { GraphInspector } from './GraphInspector';
import { computeCytoscapeEdges, collapseNodesForVisuals } from '../utils/graphUtils';

cytoscape.use(cola);

// Configuration for Force Layouts
const FORCE_LAYOUT_CONFIG = {
    cola: {
        animate: false,
        fit: true,
        flow: { axis: 'x', minSeparation: 30 },
        edgeLength: {
            track: 50,
            attribute: 20
        }
    }
};

export const ForceView: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const {
        graph,
        linkingAttribute,
        rowLabelMap,
        activeAttribute,
        availableAttributes,
        visibleRowLabels,
        updateNode,
        deleteNode,
        createTrack
    } = useGraphContext();
    const cyRef = useRef<cytoscape.Core | null>(null);

    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [inspectorCoords, setInspectorCoords] = useState({ x: 0, y: 0 });

    // Compute node labels (v1, v2, etc.) based on persistent property
    const nodeLabels = useMemo(() => {
        return new Map(graph.nodes.map((n) => [n.id, n.label || '']));
    }, [graph.nodes]);

    // Pre-process graph to handle stacked nodes
    const { visualNodes, visualEdges } = useMemo(() => {
        return collapseNodesForVisuals(graph.nodes, graph.edges);
    }, [graph.nodes, graph.edges]);

    // Compute edges for Force view (same logic as DAG)
    const forceEdges = useMemo(() => {
        return computeCytoscapeEdges(visualNodes, visualEdges, 'force-edge');
    }, [visualNodes, visualEdges]);

    useEffect(() => {
        if (!containerRef.current) return;

        // Transform nodes for Cytoscape
        const cyNodes = visualNodes.map((node: any) => {
            const trackLabel = rowLabelMap[activeAttribute]?.[node.track] || '';
            const nodeColor = getTrackColor(trackLabel);
            const label = node.label;
            const count = node._stackCount || 1;
            // Scale size: Base + 10px per extra node, capped at 2x size
            const size = Math.min(NODE_DIAMETER * 2, NODE_DIAMETER + (count - 1) * 10);

            return {
                data: {
                    id: node.id,
                    label: label,
                    color: nodeColor,
                    count: count,
                    size: size,
                    // Store original node data for potential tooltip/styling
                    ...node,
                },
                // Initial positions based on Time (X) and Track (Y) to guide the force layout
                position: {
                    x: node.time * 250, // Strong horizontal separation for time
                    y: node.track * 100 // Initial vertical separation
                }
            };
        });

        // Create a map of node colors for edges
        const nodeColorMap = new Map(cyNodes.map(n => [n.data.id, n.data.color]));

        // Transform edges to include color
        const cyEdges = forceEdges.map(edge => ({
            ...edge,
            data: {
                ...edge.data,
                color: nodeColorMap.get(edge.data.source) || '#000000'
            }
        }));

        const layoutConfig = {
            name: 'cola',
            ...FORCE_LAYOUT_CONFIG.cola,
            edgeLength: (edge: any) => {
                return edge.data('type') === 'implicit'
                    ? FORCE_LAYOUT_CONFIG.cola.edgeLength.track
                    : FORCE_LAYOUT_CONFIG.cola.edgeLength.attribute;
            },
        };

        // Initialize Cytoscape
        const cy = cytoscape({
            container: containerRef.current,
            elements: [...cyNodes, ...cyEdges],
            layout: layoutConfig as any,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': 'data(color)',
                        'border-width': 3,
                        'border-color': '#000000',
                        'label': 'data(label)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'text-wrap': 'wrap',
                        'text-max-width': '100px',
                        'font-size': '10px',
                        'font-weight': 'bold',
                        'width': 'data(size)',
                        'height': 'data(size)',
                        'shape': 'ellipse',
                        'z-index': 10, // Ensure nodes are on top
                    },
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'curve-style': 'bezier',
                        'target-arrow-shape': 'triangle',
                    },
                },
                {
                    selector: 'edge[type="implicit"]',
                    style: {
                        'width': NODE_DIAMETER, // Same size as node
                        'line-color': 'data(color)', // Same color as source node
                        'opacity': 0.5, // Half transparent
                        'target-arrow-shape': 'none', // No arrow
                        'line-style': 'solid',
                        'curve-style': 'haystack', // Connects from center to center
                        'z-index': 0, // Bottom layer
                    },
                },
                {
                    selector: 'edge[type="attribute"]',
                    style: {
                        'width': 3,
                        'line-color': '#000000', // Black
                        'target-arrow-color': '#000000',
                        'target-arrow-shape': 'triangle',
                        'line-style': 'solid',
                        'curve-style': 'bezier',
                        'z-index': 2, // Top layer
                    },
                },
            ],
            // Interaction settings
            autoungrabify: false, // Allow dragging in force layout
            userPanningEnabled: true,
            userZoomingEnabled: true,
            boxSelectionEnabled: false,
        });

        cyRef.current = cy;

        // Event Listeners
        cy.on('mouseover', 'node', (e) => {
            const node = e.target;
            const renderedPos = node.renderedPosition();
            const containerRect = containerRef.current?.getBoundingClientRect();

            if (containerRect) {
                setInspectorCoords({
                    x: containerRect.left + renderedPos.x,
                    y: containerRect.top + renderedPos.y
                });
                setHoveredNodeId(node.id());
            }
        });

        cy.on('mouseout', 'node', () => {
            setHoveredNodeId(null);
        });

        cy.on('tap', 'node', (e) => {
            const node = e.target;
            const renderedPos = node.renderedPosition();
            const containerRect = containerRef.current?.getBoundingClientRect();

            if (containerRect) {
                setInspectorCoords({
                    x: containerRect.left + renderedPos.x,
                    y: containerRect.top + renderedPos.y
                });
                setSelectedNodeId(node.id());
            }
        });

        cy.on('tap', (e) => {
            if (e.target === cy) {
                setSelectedNodeId(null);
            }
        });

        // Cleanup
        return () => {
            cy.destroy();
        };
    }, [graph.nodes, forceEdges, activeAttribute, rowLabelMap, nodeLabels]);

    // Inspector Logic
    const activeNode = selectedNodeId || hoveredNodeId
        ? graph.nodes.find(n => n.id === (selectedNodeId || hoveredNodeId))
        : null;

    return (
        <div className="w-full h-full bg-slate-50 border border-slate-200 rounded-lg overflow-hidden flex flex-col relative">
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800">Force Layout</h2>
                <div className="text-sm text-slate-500">
                    {graph.nodes.length} Nodes • {forceEdges.length} Edges
                </div>
            </div>
            <div ref={containerRef} className="flex-1 w-full h-full" />

            {activeNode && (
                <GraphInspector
                    type="node"
                    data={activeNode}
                    graph={graph}
                    mode={selectedNodeId ? "edit" : "preview"}
                    x={inspectorCoords.x}
                    y={inspectorCoords.y}
                    onClose={() => setSelectedNodeId(null)}
                    onUpdateNode={updateNode}
                    onSelectNode={setSelectedNodeId}
                    onDeleteNode={(id) => {
                        deleteNode(id);
                        setSelectedNodeId(null);
                    }}
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
