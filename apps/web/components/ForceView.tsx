import React, { useEffect, useRef, useMemo, useState } from 'react';
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import { useGraphContext } from '../context/GraphContext';
import { getTrackColor, NODE_DIAMETER } from '../constants';
import { GraphInspector } from './GraphInspector';
import { computeCytoscapeEdges } from '../utils/graphUtils';

cytoscape.use(cola);

// Configuration for Force Layouts
const FORCE_LAYOUT_CONFIG = {
    cola: {
        componentSpacing: 40,
        nodeRepulsion: 4096,
        edgeLength: {
            track: 12,
            attribute: 24
        },
        nestingFactor: 1.2,
        gravity: 10,
        flowSeparation: 100
    },
    cose: {
        componentSpacing: 60,
        nodeRepulsion: 100,
        edgeLength: {
            track: 100,
            attribute: 200
        },
        edgeElasticity: 150,
        nestingFactor: 5,
        gravity: 0.1,
        numIter: 1000,
        initialTemp: 1000,
        coolingFactor: 0.9,
        minTemp: 1.0,
    }
};

interface ForceViewProps {
    layoutType?: 'cola' | 'cose';
}

export const ForceView: React.FC<ForceViewProps> = ({ layoutType = 'cola' }) => {
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

    // Compute edges for Force view (same logic as DAG)
    const forceEdges = useMemo(() => {
        return computeCytoscapeEdges(graph.nodes, linkingAttribute, 'force-edge');
    }, [graph.nodes, linkingAttribute]);

    useEffect(() => {
        if (!containerRef.current) return;

        // Transform nodes for Cytoscape
        const cyNodes = graph.nodes.map((node) => {
            const trackLabel = rowLabelMap[activeAttribute]?.[node.track] || '';
            const nodeColor = getTrackColor(trackLabel);
            const label = nodeLabels.get(node.id) || '';

            return {
                data: {
                    id: node.id,
                    label: label,
                    color: nodeColor,
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

        const layoutConfig = layoutType === 'cola' ? {
            name: 'cola', // Cola layout for constraints
            animate: true,
            refresh: 1,
            maxSimulationTime: 4000,
            ungrabifyWhileSimulating: false,
            fit: true,
            padding: 30,
            boundingBox: undefined,
            nodeDimensionsIncludeLabels: false,
            randomize: false, // Use initial positions
            componentSpacing: FORCE_LAYOUT_CONFIG.cola.componentSpacing,
            nodeRepulsion: FORCE_LAYOUT_CONFIG.cola.nodeRepulsion,
            nodeOverlap: 4,
            edgeLength: (edge: any) => {
                // Make track edges (structural) shorter/tighter, attribute edges longer
                return edge.data('type') === 'track'
                    ? FORCE_LAYOUT_CONFIG.cola.edgeLength.track
                    : FORCE_LAYOUT_CONFIG.cola.edgeLength.attribute;
            },
            nestingFactor: FORCE_LAYOUT_CONFIG.cola.nestingFactor,
            gravity: FORCE_LAYOUT_CONFIG.cola.gravity,
            numIter: 1000,
            initialTemp: 1000,
            coolingFactor: 0.99,
            minTemp: 1.0,
            // Cola specific constraints
            flow: { axis: 'x', minSeparation: FORCE_LAYOUT_CONFIG.cola.flowSeparation }, // Enforce left-to-right flow based on edges
            // Align nodes with same time index to same X coordinate (soft constraint)
            alignment: (node: any) => {
                return { x: node.data('time'), y: 0 };
            }
        } : {
            name: 'cose', // Force-directed layout
            animate: true,
            refresh: 20,
            fit: true,
            padding: 30,
            boundingBox: undefined,
            nodeDimensionsIncludeLabels: false,
            randomize: false, // Use initial positions
            componentSpacing: FORCE_LAYOUT_CONFIG.cose.componentSpacing,
            nodeRepulsion: (node: any) => FORCE_LAYOUT_CONFIG.cose.nodeRepulsion,
            nodeOverlap: 4,
            idealEdgeLength: (edge: any) => {
                // Make track edges (structural) shorter/tighter, attribute edges longer
                return edge.data('type') === 'track'
                    ? FORCE_LAYOUT_CONFIG.cose.edgeLength.track
                    : FORCE_LAYOUT_CONFIG.cose.edgeLength.attribute;
            },
            edgeElasticity: (edge: any) => FORCE_LAYOUT_CONFIG.cose.edgeElasticity,
            nestingFactor: FORCE_LAYOUT_CONFIG.cose.nestingFactor,
            gravity: FORCE_LAYOUT_CONFIG.cose.gravity,
            numIter: FORCE_LAYOUT_CONFIG.cose.numIter,
            initialTemp: FORCE_LAYOUT_CONFIG.cose.initialTemp,
            coolingFactor: FORCE_LAYOUT_CONFIG.cose.coolingFactor,
            minTemp: FORCE_LAYOUT_CONFIG.cose.minTemp
        };

        // Initialize Cytoscape
        const cy = cytoscape({
            container: containerRef.current,
            elements: [...cyNodes, ...forceEdges],
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
                        'line-color': '#cbd5e1', // slate-300
                        'target-arrow-color': '#cbd5e1',
                        'line-style': 'dashed',
                    },
                },
                {
                    selector: 'edge[type="attribute"]',
                    style: {
                        'width': 2,
                        'line-color': '#000000', // Black
                        'target-arrow-color': '#000000',
                        'line-style': 'solid',
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
    }, [graph.nodes, forceEdges, layoutType, activeAttribute, rowLabelMap, nodeLabels]);

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
