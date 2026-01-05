import React, { useEffect, useRef, useMemo, useState } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { useGraphContext } from '../context/GraphContext';
import { getTrackColor, NODE_DIAMETER } from '../constants';
import { GraphInspector } from './GraphInspector';

cytoscape.use(dagre);

export const DAGView: React.FC = () => {
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

    // Compute edges for DAG view
    const dagEdges = useMemo(() => {
        const edges: any[] = [];
        const edgeIds = new Set<string>();

        const addEdge = (uId: string, vId: string, type: 'track' | 'attribute') => {
            const id = `dag-edge-${uId}-${vId}`;
            if (!edgeIds.has(id)) {
                edgeIds.add(id);
                edges.push({
                    data: {
                        id,
                        source: uId,
                        target: vId,
                        type
                    },
                });
            }
        };

        // 1. Track Connections: Connect nodes in the same track sequentially
        const nodesByTrack: Record<number, typeof graph.nodes> = {};
        graph.nodes.forEach(n => {
            if (!nodesByTrack[n.track]) nodesByTrack[n.track] = [];
            nodesByTrack[n.track].push(n);
        });

        Object.values(nodesByTrack).forEach(trackNodes => {
            trackNodes.sort((a, b) => a.time - b.time);
            for (let i = 0; i < trackNodes.length - 1; i++) {
                addEdge(trackNodes[i].id, trackNodes[i + 1].id, 'track');
            }
        });

        // 2. Attribute Connections: Connect nodes in adjacent time steps (T -> T+1) if they share attributes
        const nodesByTime: Record<number, typeof graph.nodes> = {};
        graph.nodes.forEach(n => {
            if (!nodesByTime[n.time]) nodesByTime[n.time] = [];
            nodesByTime[n.time].push(n);
        });

        const times = Object.keys(nodesByTime).map(Number).sort((a, b) => a - b);

        for (let i = 0; i < times.length; i++) {
            const t = times[i];
            if (!nodesByTime[t + 1]) continue;

            const currentNodes = nodesByTime[t];
            const nextNodes = nodesByTime[t + 1];

            currentNodes.forEach(u => {
                nextNodes.forEach(v => {
                    const uAttrs = u.attributes[linkingAttribute] || [];
                    const vAttrs = v.attributes[linkingAttribute] || [];
                    const isConnected = uAttrs.some(val => vAttrs.includes(val));

                    if (isConnected) {
                        addEdge(u.id, v.id, 'attribute');
                    }
                });
            });
        }
        return edges;
    }, [graph.nodes, linkingAttribute]);

    useEffect(() => {
        if (!containerRef.current) return;

        // Transform nodes for Cytoscape
        const cyNodes = graph.nodes.map((node) => {
            const trackLabel = rowLabelMap[activeAttribute]?.[node.track] || '';
            const nodeColor = getTrackColor(trackLabel);

            return {
                data: {
                    id: node.id,
                    label: node.content || '',
                    color: nodeColor,
                    // Store original node data for potential tooltip/styling
                    ...node,
                },
            };
        });

        // Initialize Cytoscape
        const cy = cytoscape({
            container: containerRef.current,
            elements: [...cyNodes, ...dagEdges],
            layout: {
                name: 'dagre',
                rankDir: 'LR', // Left to Right
                nodeSep: 50,
                rankSep: 100,
                padding: 20,
                animate: true,
            },
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': 'data(color)',
                        'border-width': 3,
                        'border-color': '#000000',
                        'label': '', // Empty label as requested
                        'width': NODE_DIAMETER,
                        'height': NODE_DIAMETER,
                        'shape': 'ellipse',
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
                    selector: 'edge[type="track"]',
                    style: {
                        'width': 2,
                        'line-color': '#cbd5e1', // slate-300 (subtle track flow)
                        'target-arrow-color': '#cbd5e1',
                        'line-style': 'dashed',
                    },
                },
                {
                    selector: 'edge[type="attribute"]',
                    style: {
                        'width': 2,
                        'line-color': '#000000', // Black (matching grid edges)
                        'target-arrow-color': '#000000',
                        'line-style': 'solid',
                    },
                },
            ],
            // Interaction settings
            autoungrabify: true, // No dragging nodes
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
    }, [graph.nodes, dagEdges]); // Re-run when nodes or computed edges change

    // Inspector Logic
    const activeNode = selectedNodeId || hoveredNodeId
        ? graph.nodes.find(n => n.id === (selectedNodeId || hoveredNodeId))
        : null;

    return (
        <div className="w-full h-full bg-slate-50 border border-slate-200 rounded-lg overflow-hidden flex flex-col relative">
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800">DAG View</h2>
                <div className="text-sm text-slate-500">
                    {graph.nodes.length} Nodes • {dagEdges.length} Edges
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
