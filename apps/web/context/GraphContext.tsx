
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { NarrativeGraph, NarrativeNode, Motif, Source } from '../types';
import {
    DEFAULT_ROWS_COUNT,
    DEFAULT_COLS_COUNT,
    DEFAULT_ATTRIBUTES,
    INITIAL_AXIS,
    INITIAL_LINKING
} from '../constants';
import { computeEdges } from '../utils/computeEdges';

interface GridConfig {
    rows: number;
    cols: number;
}

interface GraphContextType {
    // Data
    graph: NarrativeGraph;
    gridConfig: GridConfig;

    // Attributes & Tracks
    availableAttributes: string[];
    activeAttribute: string; // The 'Alpha' Axis
    linkingAttribute: string; // The 'Beta' Rule
    rowLabelMap: Record<string, string[]>; // Master list of track labels per attribute
    hiddenLabels: string[]; // Visibility filter
    visibleRowLabels: string[]; // Computed visible labels

    // Actions
    setGraphData: (nodes: NarrativeNode[], sources?: Source[]) => void;
    addMotifToGraph: (motif: Motif, startT: number, startH: number) => void;
    addManualNode: (t: number, h: number) => void;
    moveNode: (nodeId: string, t: number, h: number) => void;
    updateNode: (id: string, data: { attributes: Record<string, string[]>, content: string }) => void;
    deleteNode: (id: string) => void;

    // Config Actions
    setActiveAttribute: (attr: string) => void;
    setLinkingAttribute: (attr: string) => void;
    addAttribute: (attr: string) => void;
    deleteAttribute: (attr: string) => void;

    // Track Actions
    updateRowLabel: (index: number, value: string) => void;
    reorderTracks: (newOrder: string[]) => void;
    toggleTrackVisibility: (label: string) => void;
    createTrack: (value: string) => void;
    deleteTrack: (label: string) => void;

    // Grid Actions
    adjustGrid: (type: 'rows' | 'cols', delta: number) => void;
    clearGraph: () => void;

    // History
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

const GraphContext = createContext<GraphContextType | undefined>(undefined);

// --- State Types ---
interface AppState {
    graph: NarrativeGraph;
    gridCols: number;
    availableAttributes: string[];
    activeAttribute: string;
    linkingAttribute: string;
    hiddenLabels: string[];
    rowLabelMap: Record<string, string[]>;
}

const INITIAL_STATE: AppState = {
    graph: { nodes: [], edges: [], sources: [] },
    gridCols: DEFAULT_COLS_COUNT,
    availableAttributes: DEFAULT_ATTRIBUTES,
    activeAttribute: INITIAL_AXIS,
    linkingAttribute: INITIAL_LINKING,
    hiddenLabels: [],
    rowLabelMap: (() => {
        const initialMap: Record<string, string[]> = {};
        DEFAULT_ATTRIBUTES.forEach(attr => {
            initialMap[attr] = Array(DEFAULT_ROWS_COUNT).fill('').map((_, i) => `${attr} ${i + 1}`);
        });
        return initialMap;
    })()
};

export const GraphProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- STATE ---
    const [history, setHistory] = useState<{
        past: AppState[];
        present: AppState;
        future: AppState[];
    }>({
        past: [],
        present: INITIAL_STATE,
        future: []
    });

    // Helpers
    const { past, present, future } = history;

    // Derived values for backward compatibility and ease of use
    const {
        graph, gridCols, availableAttributes, activeAttribute, linkingAttribute, hiddenLabels, rowLabelMap
    } = present;

    const pushState = useCallback((updates: Partial<AppState>) => {
        setHistory(curr => ({
            past: [...curr.past, curr.present],
            present: { ...curr.present, ...updates },
            future: []
        }));
    }, []);

    const replaceState = useCallback((updates: Partial<AppState>) => {
        setHistory(curr => ({
            ...curr,
            present: { ...curr.present, ...updates }
        }));
    }, []);

    const undo = useCallback(() => {
        if (past.length === 0) return;
        setHistory(curr => {
            const newPast = curr.past.slice(0, -1);
            const previous = curr.past[curr.past.length - 1];
            return {
                past: newPast,
                present: previous,
                future: [curr.present, ...curr.future]
            };
        });
    }, [past.length]);

    const redo = useCallback(() => {
        if (future.length === 0) return;
        setHistory(curr => {
            const [next, ...newFuture] = curr.future;
            return {
                past: [...curr.past, curr.present],
                present: next,
                future: newFuture
            };
        });
    }, [future.length]);

    // --- COMPUTED VALUES ---

    // 1. Visible Labels (Alpha Filter)
    const visibleRowLabels = useMemo(() => {
        const allLabels = rowLabelMap[activeAttribute] || [];
        return allLabels.filter(l => !l || !hiddenLabels.includes(l));
    }, [rowLabelMap, activeAttribute, hiddenLabels]);

    // Derived Grid Config
    const gridConfig = useMemo(() => ({
        rows: Math.max(0, visibleRowLabels.length),
        cols: gridCols
    }), [visibleRowLabels.length, gridCols]);

    // 2. Edges come from the Beta rule in utils/computeEdges.ts (a pure function, shared with the Python engine's tests)

    // 3. Update Graph Edges Effect & Persistent Labels
    useEffect(() => {
        // Calculate based on PRESENT state
        const sortedNodes = [...graph.nodes].sort((a, b) => {
            if (a.time !== b.time) return a.time - b.time;
            return a.track - b.track;
        });

        // Assign labels
        const labeledNodes = sortedNodes.map((n, i) => ({
            ...n,
            label: `v${i + 1}`
        }));

        const currentLabels = new Map(graph.nodes.map(n => [n.id, n.label]));
        const newLabels = new Map(labeledNodes.map(n => [n.id, n.label]));

        let nodesToUse = graph.nodes;
        let labelsChanged = false;

        for (const [id, label] of newLabels) {
            if (currentLabels.get(id) !== label) {
                labelsChanged = true;
                break;
            }
        }

        if (labelsChanged) {
            nodesToUse = labeledNodes;
        }

        const newEdges = computeEdges(nodesToUse, linkingAttribute, gridCols);

        // Only update if something changed
        if (labelsChanged || JSON.stringify(newEdges) !== JSON.stringify(graph.edges)) {
            replaceState({
                graph: {
                    ...graph,
                    nodes: nodesToUse,
                    edges: newEdges
                }
            });
        }
    }, [linkingAttribute, graph.nodes, gridCols, graph.edges, replaceState]); // Added dependencies

    // 4. Alpha Rule Effect (Track Assignment)
    useEffect(() => {
        const priorityOrder = rowLabelMap[activeAttribute] || [];
        const priorityLookup = new Map<string, number>();
        priorityOrder.forEach((label, idx) => {
            if (label) priorityLookup.set(label, idx);
        });

        const visibleIndexLookup = new Map<string, number>();
        visibleRowLabels.forEach((label, idx) => {
            if (label) visibleIndexLookup.set(label, idx);
        });

        let changed = false;
        const newNodes = graph.nodes.map(node => {
            const vals = node.attributes[activeAttribute] || [];
            let bestLabel: string | null = null;
            let bestPriority = Infinity;
            let newTrack = -1;

            vals.forEach(val => {
                const p = priorityLookup.has(val) ? priorityLookup.get(val)! : Infinity;
                if (p < bestPriority) {
                    bestPriority = p;
                    bestLabel = val;
                }
            });

            if (bestLabel !== null && visibleIndexLookup.has(bestLabel)) {
                newTrack = visibleIndexLookup.get(bestLabel)!;
            }

            if (node.track !== newTrack) changed = true;
            return { ...node, track: newTrack };
        });

        if (changed) {
            replaceState({
                graph: {
                    ...graph,
                    nodes: newNodes
                }
            });
        }
    }, [visibleRowLabels, activeAttribute, rowLabelMap, graph.nodes, replaceState]); // Added dependencies


    // --- ACTIONS ---

    const setGraphData = (nodes: NarrativeNode[], sources: Source[] = []) => {
        const nextAvailableAttributes = new Set(availableAttributes);
        const nextRowLabelMap = { ...rowLabelMap };

        const incomingAttrValues: Record<string, Set<string>> = {};
        nodes.forEach(node => {
            Object.entries(node.attributes).forEach(([attr, values]) => {
                nextAvailableAttributes.add(attr);
                if (!incomingAttrValues[attr]) incomingAttrValues[attr] = new Set();
                values.forEach(v => incomingAttrValues[attr].add(v));
            });
        });

        Object.entries(incomingAttrValues).forEach(([attr, valueSet]) => {
            nextRowLabelMap[attr] = Array.from(valueSet);
        });

        const maxTime = nodes.length > 0 ? Math.max(...nodes.map(n => n.time)) : 0;

        pushState({
            availableAttributes: Array.from(nextAvailableAttributes),
            rowLabelMap: nextRowLabelMap,
            hiddenLabels: [],
            gridCols: Math.max(maxTime + 1, DEFAULT_COLS_COUNT),
            graph: { nodes, edges: [], sources }
        });
    };

    const addMotifToGraph = (motif: Motif, startT: number, startH: number) => {
        const activeRowLabels = visibleRowLabels;

        const maxRelTrack = Math.max(...motif.nodes.map(n => n.relTrack));
        const maxRelTime = Math.max(...motif.nodes.map(n => n.relTime));

        if (startH + maxRelTrack >= activeRowLabels.length) return;
        if (startT + maxRelTime >= gridCols) return;

        const linkRowLabels = rowLabelMap[linkingAttribute] || [];
        const rootNode = motif.nodes[0];
        const rootRow = startH + (rootNode ? rootNode.relTrack : 0);

        let commonLinkValue = linkRowLabels[rootRow];
        if (!commonLinkValue || commonLinkValue === '') {
            commonLinkValue = `${linkingAttribute} ${rootRow + 1}`;
        }

        let pendingRowUpdates: Record<number, string> = {};
        const newNodes: NarrativeNode[] = [];

        motif.nodes.forEach((n) => {
            const t = startT + n.relTime;
            const h = startH + n.relTrack;

            let rowValue = activeRowLabels[h];
            if (!rowValue || rowValue === '') {
                rowValue = `${activeAttribute} ${h + 1}`;
                pendingRowUpdates[h] = rowValue;
            }

            const attributes: Record<string, string[]> = {
                [activeAttribute]: [rowValue]
            };

            if (activeAttribute !== linkingAttribute) {
                attributes[linkingAttribute] = [commonLinkValue];
            }

            newNodes.push({
                id: crypto.randomUUID(),
                time: t,
                track: h,
                motifSource: motif.name,
                attributes: attributes,
                content: ''
            });
        });

        let newRowLabelMap = rowLabelMap;
        if (Object.keys(pendingRowUpdates).length > 0) {
            const current = [...(rowLabelMap[activeAttribute] || [])];
            Object.entries(pendingRowUpdates).forEach(([hStr, val]) => {
                const hIndex = parseInt(hStr);
                const visibleLabel = visibleRowLabels[hIndex];
                const masterIdx = current.indexOf(visibleLabel);
                if (masterIdx !== -1) current[masterIdx] = val;
            });
            newRowLabelMap = { ...rowLabelMap, [activeAttribute]: current };
        }

        pushState({
            rowLabelMap: newRowLabelMap,
            graph: { ...graph, nodes: [...graph.nodes, ...newNodes] }
        });
    };

    const addManualNode = (t: number, h: number) => {
        const activeRowLabels = visibleRowLabels;
        if (h >= activeRowLabels.length || t >= gridCols) return;

        let newRowLabelMap = rowLabelMap;
        let rowValue = activeRowLabels[h];

        // Update Label Logic Inline
        if (!rowValue) {
            rowValue = `${activeAttribute} ${h + 1}`;
            // Logic to update row label map
            const oldLabel = visibleRowLabels[h]; // is undefined or empty
            const current = [...(rowLabelMap[activeAttribute] || [])];
            const masterIndex = current.indexOf(oldLabel);
            if (masterIndex !== -1) {
                current[masterIndex] = rowValue;
            } else {
                // Fallback if not found (shouldn't happen for valid h)
            }
            newRowLabelMap = { ...rowLabelMap, [activeAttribute]: current };

            // Also need to update existing nodes if we are reusing logic?
            // Existing 'updateRowLabel' does update nodes. 
            // In addManualNode, we create a new node. Do we update others?
            // Only if they shared the empty label? usually empty label means no nodes there.
        }

        const initialAttributes: Record<string, string[]> = {
            [activeAttribute]: [rowValue]
        };

        if (activeAttribute !== linkingAttribute) {
            const linkRowLabels = rowLabelMap[linkingAttribute] || [];
            let linkValue = linkRowLabels[h];
            if (!linkValue || linkValue === '') {
                linkValue = `${linkingAttribute} ${h + 1}`;
            }
            initialAttributes[linkingAttribute] = [linkValue];
        }

        const newNode: NarrativeNode = {
            id: crypto.randomUUID(),
            time: t,
            track: h,
            motifSource: 'Manual',
            attributes: initialAttributes,
            content: ''
        };

        // If we updated row labels, we should strictly also update any other nodes on that track (Alpha rule)
        // But if the label was empty, no nodes should be there?
        // Let's assume safely we just add the node.

        pushState({
            rowLabelMap: newRowLabelMap,
            graph: { ...graph, nodes: [...graph.nodes, newNode] }
        });
    };

    const moveNode = (nodeId: string, t: number, h: number) => {
        const node = graph.nodes.find(n => n.id === nodeId);
        if (!node) return;
        if (h >= visibleRowLabels.length || t >= gridCols) return;

        let newRowLabelMap = rowLabelMap;
        let rowValue = visibleRowLabels[h];

        if (!rowValue) {
            rowValue = `${activeAttribute} ${h + 1}`;
            const current = [...(rowLabelMap[activeAttribute] || [])];
            // Find current mapping for the empty label at track h
            // This is tricky because visibleRowLabels is derived.
            // We need the index in the MASTER list?
            // visibleRowLabels contains values from master list.
            // If activeRowLabels[h] is empty string, we find where that empty string is in master list?
            // There might be multiple empty strings.
            // We rely on stable filtering.

            // Simplification: We rely on maintaining the structure.
            // Actually, `updateRowLabel` uses `visibleRowLabels[index]` to find oldLabel.
            const oldLabel = visibleRowLabels[h];
            const masterIndex = current.indexOf(oldLabel);
            if (masterIndex !== -1) current[masterIndex] = rowValue;
            newRowLabelMap = { ...rowLabelMap, [activeAttribute]: current };
        }

        const newAttributes = { ...node.attributes };
        const currentAttrs = newAttributes[activeAttribute] || [];
        const filteredAttrs = currentAttrs.filter(a => a !== rowValue);
        newAttributes[activeAttribute] = [rowValue, ...filteredAttrs];

        const updatedNodes = graph.nodes.map(n =>
            n.id === nodeId ? { ...n, time: t, track: h, attributes: newAttributes } : n
        );

        pushState({
            rowLabelMap: newRowLabelMap,
            graph: { ...graph, nodes: updatedNodes }
        });
    };

    const updateNode = (id: string, data: { attributes: Record<string, string[]>, content: string }) => {
        pushState({
            graph: {
                ...graph,
                nodes: graph.nodes.map(n => {
                    if (n.id !== id) return n;
                    return { ...n, attributes: data.attributes, content: data.content };
                })
            }
        });
    };

    const deleteNode = (id: string) => {
        pushState({
            graph: {
                ...graph,
                nodes: graph.nodes.filter(n => n.id !== id)
            }
        });
    };

    const updateRowLabel = (index: number, newValue: string) => {
        const oldLabel = visibleRowLabels[index];

        const current = [...(rowLabelMap[activeAttribute] || [])];
        const masterIndex = current.indexOf(oldLabel);
        if (masterIndex !== -1) {
            current[masterIndex] = newValue;
        }
        const newRowLabelMap = { ...rowLabelMap, [activeAttribute]: current };

        const newNodes = graph.nodes.map(n => {
            if (n.track === index) {
                const currentAttrs = n.attributes[activeAttribute] || [];
                let newAttrs = [...currentAttrs];
                if (oldLabel) newAttrs = newAttrs.filter(v => v !== oldLabel);
                if (newValue && !newAttrs.includes(newValue)) {
                    newAttrs = [newValue, ...newAttrs];
                }
                return { ...n, attributes: { ...n.attributes, [activeAttribute]: newAttrs } };
            }
            return n;
        });

        pushState({
            rowLabelMap: newRowLabelMap,
            graph: { ...graph, nodes: newNodes }
        });
    };

    const createTrack = (value: string) => {
        const current = rowLabelMap[activeAttribute] || [];
        if (!current.includes(value)) {
            pushState({
                rowLabelMap: { ...rowLabelMap, [activeAttribute]: [...current, value] }
            });
        }
    };

    const deleteTrack = (label: string) => {
        const current = rowLabelMap[activeAttribute] || [];
        const newRowLabelMap = { ...rowLabelMap, [activeAttribute]: current.filter(l => l !== label) };

        const newNodes = graph.nodes.map(n => {
            const attrs = n.attributes[activeAttribute] || [];
            if (attrs.includes(label)) {
                const newAttrs = attrs.filter(v => v !== label);
                return { ...n, attributes: { ...n.attributes, [activeAttribute]: newAttrs } };
            }
            return n;
        });

        pushState({
            rowLabelMap: newRowLabelMap,
            hiddenLabels: hiddenLabels.filter(l => l !== label),
            graph: { ...graph, nodes: newNodes }
        });
    };

    const reorderTracks = (newOrder: string[]) => {
        const oldVisibleLabels = [...visibleRowLabels];
        const newRowLabelMap = { ...rowLabelMap, [activeAttribute]: newOrder };

        const newVisibleLabels = newOrder.filter(l => !l || !hiddenLabels.includes(l));

        const newNodes = graph.nodes.map(n => {
            const label = oldVisibleLabels[n.track];
            const newIndex = newVisibleLabels.indexOf(label);
            if (newIndex !== -1 && newIndex !== n.track) {
                return { ...n, track: newIndex };
            }
            return n;
        });

        pushState({
            rowLabelMap: newRowLabelMap,
            graph: { ...graph, nodes: newNodes }
        });
    };

    const toggleTrackVisibility = (label: string) => {
        pushState({
            hiddenLabels: hiddenLabels.includes(label)
                ? hiddenLabels.filter(l => l !== label)
                : [...hiddenLabels, label]
        });
    };

    const addAttribute = (attr: string) => {
        if (!availableAttributes.includes(attr)) {
            pushState({
                availableAttributes: [...availableAttributes, attr],
                rowLabelMap: {
                    ...rowLabelMap,
                    [attr]: Array(DEFAULT_ROWS_COUNT).fill('').map((_, i) => `${attr} ${i + 1}`)
                }
            });
        }
    };

    const setActiveAttribute = (attr: string) => {
        pushState({ activeAttribute: attr });
    }

    const setLinkingAttribute = (attr: string) => {
        pushState({ linkingAttribute: attr });
    }

    const deleteAttribute = (attr: string) => {
        if (availableAttributes.length <= 1) return;
        const newAttrs = availableAttributes.filter(a => a !== attr);

        let newActive = activeAttribute;
        let newLinking = linkingAttribute;

        if (activeAttribute === attr) newActive = newAttrs[0];
        if (linkingAttribute === attr) newLinking = newAttrs[0];

        const nextMap = { ...rowLabelMap };
        delete nextMap[attr];

        const newNodes = graph.nodes.map(n => {
            const newAttributes = { ...n.attributes };
            delete newAttributes[attr];
            return { ...n, attributes: newAttributes };
        });

        pushState({
            availableAttributes: newAttrs,
            activeAttribute: newActive,
            linkingAttribute: newLinking,
            rowLabelMap: nextMap,
            graph: { ...graph, nodes: newNodes }
        });
    };

    const adjustGrid = (type: 'rows' | 'cols', delta: number) => {
        if (type === 'cols') {
            pushState({
                gridCols: Math.max(1, gridCols + delta)
            });
        } else {
            if (delta > 0) {
                const allLabels = rowLabelMap[activeAttribute] || [];
                const hiddenLabel = allLabels.find(l => hiddenLabels.includes(l));

                if (hiddenLabel) {
                    toggleTrackVisibility(hiddenLabel);
                } else {
                    const nextNum = allLabels.length + 1;
                    createTrack(`${activeAttribute} ${nextNum}`);
                }
            } else {
                if (visibleRowLabels.length > 0) {
                    const lastVisible = visibleRowLabels[visibleRowLabels.length - 1];
                    toggleTrackVisibility(lastVisible);
                }
            }
        }
    };

    const clearGraph = () => {
        pushState({
            graph: { nodes: [], edges: [], sources: [] },
            hiddenLabels: [],
            rowLabelMap: {
                ...rowLabelMap,
                [activeAttribute]: Array(DEFAULT_ROWS_COUNT).fill('').map((_, i) => `${activeAttribute} ${i + 1}`)
            }
        });
    };

    useEffect(() => {
        if (hiddenLabels.length > 0) {
            // If we want this to be undoable, use replaceState?
            // But resetting hidden labels on attribute switch is a UX choice.
            replaceState({ hiddenLabels: [] });
        }
    }, [activeAttribute]); // Only runs when attribute changes

    return (
        <GraphContext.Provider value={{
            graph, gridConfig, availableAttributes, activeAttribute, linkingAttribute,
            rowLabelMap, hiddenLabels, visibleRowLabels,
            setGraphData, addMotifToGraph, addManualNode, moveNode, updateNode, deleteNode,
            setActiveAttribute, setLinkingAttribute, addAttribute, deleteAttribute,
            updateRowLabel, reorderTracks, toggleTrackVisibility, createTrack, deleteTrack,
            adjustGrid, clearGraph,
            undo, redo, canUndo: past.length > 0, canRedo: future.length > 0
        }}>
            {children}
        </GraphContext.Provider>
    );
};

export const useGraphContext = () => {
    const context = useContext(GraphContext);
    if (!context) throw new Error("useGraphContext must be used within a GraphProvider");
    return context;
};
