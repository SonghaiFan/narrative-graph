
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { NarrativeGraph, NarrativeNode, NarrativeEdge, Motif, Source } from '../types';
import {
    DEFAULT_ROWS_COUNT,
    DEFAULT_COLS_COUNT,
    DEFAULT_ATTRIBUTES,
    INITIAL_AXIS,
    INITIAL_LINKING
} from '../constants';

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
}

const GraphContext = createContext<GraphContextType | undefined>(undefined);

export const GraphProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- STATE ---
    const [graph, setGraph] = useState<NarrativeGraph>({ nodes: [], edges: [], sources: [] });
    // Note: 'rows' is now derived from visible labels, only 'cols' is explicit state
    const [gridCols, setGridCols] = useState(DEFAULT_COLS_COUNT);

    const [availableAttributes, setAvailableAttributes] = useState<string[]>(DEFAULT_ATTRIBUTES);
    const [activeAttribute, setActiveAttribute] = useState<string>(INITIAL_AXIS);
    const [linkingAttribute, setLinkingAttribute] = useState<string>(INITIAL_LINKING);

    const [hiddenLabels, setHiddenLabels] = useState<string[]>([]);
    const [rowLabelMap, setRowLabelMap] = useState<Record<string, string[]>>(() => {
        const initialMap: Record<string, string[]> = {};
        DEFAULT_ATTRIBUTES.forEach(attr => {
            initialMap[attr] = Array(DEFAULT_ROWS_COUNT).fill('').map((_, i) => `${attr} ${i + 1}`);
        });
        return initialMap;
    });

    // --- COMPUTED VALUES ---

    // 1. Visible Labels (Alpha Filter)
    const visibleRowLabels = useMemo(() => {
        const allLabels = rowLabelMap[activeAttribute] || [];
        // Keep empty strings in map but filter them out for visibility if needed?
        // Actually grid relies on index. Keep empties if they are placeholders.
        // But logic says: !l || ... so empties are kept unless explicitly hidden?
        // Wait, !l is true for empty string.
        // So empty strings are returned.
        return allLabels.filter(l => !l || !hiddenLabels.includes(l));
    }, [rowLabelMap, activeAttribute, hiddenLabels]);

    // Derived Grid Config
    const gridConfig = useMemo(() => ({
        rows: Math.max(0, visibleRowLabels.length), // Ensure visible rows match visible tracks exactly
        cols: gridCols
    }), [visibleRowLabels.length, gridCols]);

    // 2. Compute Edges (Beta Rule)
    const computeEdges = useCallback((nodes: NarrativeNode[], linkingAttr: string, maxTime: number): NarrativeEdge[] => {
        const edges: NarrativeEdge[] = [];
        const nodesByTime: Record<number, NarrativeNode[]> = {};

        nodes.forEach(n => {
            // STRICT BOUNDS CHECK: Filter out nodes that are hidden or out of time bounds
            if (n.track < 0 || n.time >= maxTime) return;

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
                    // Edge only formed between adjacent tracks (including same track)
                    const isAdjacentTrack = Math.abs(u.track - v.track) <= 1;
                    if (!isAdjacentTrack) return;

                    const uAttrs = u.attributes[linkingAttr] || [];
                    const vAttrs = v.attributes[linkingAttr] || [];
                    const isConnected = uAttrs.some(val => vAttrs.includes(val));

                    if (isConnected) {
                        edges.push({
                            id: `edge-${u.id}-${v.id}`,
                            sourceId: u.id,
                            targetId: v.id
                        });
                    }
                });
            });
        }
        return edges;
    }, []);

    // 3. Update Graph Edges Effect
    useEffect(() => {
        setGraph(prev => ({
            ...prev,
            edges: computeEdges(prev.nodes, linkingAttribute, gridCols)
        }));
    }, [linkingAttribute, computeEdges, graph.nodes, gridCols]);

    // 4. Alpha Rule Effect (Track Assignment)
    useEffect(() => {
        // Track priority follows the ordering set in the TrackPanel (rowLabelMap)
        const priorityOrder = rowLabelMap[activeAttribute] || [];
        const priorityLookup = new Map<string, number>();
        priorityOrder.forEach((label, idx) => {
            if (label) priorityLookup.set(label, idx);
        });

        const visibleIndexLookup = new Map<string, number>();
        visibleRowLabels.forEach((label, idx) => {
            if (label) visibleIndexLookup.set(label, idx);
        });

        setGraph(prev => {
            let changed = false;
            const newNodes = prev.nodes.map(node => {
                const vals = node.attributes[activeAttribute] || [];
                let bestLabel: string | null = null;
                let bestPriority = Infinity;
                let newTrack = -1;

                // Pick the attribute value with the highest priority based on track order
                vals.forEach(val => {
                    const p = priorityLookup.has(val) ? priorityLookup.get(val)! : Infinity;
                    if (p < bestPriority) {
                        bestPriority = p;
                        bestLabel = val;
                    }
                });

                // Map the chosen label to the current visible track index
                if (bestLabel !== null && visibleIndexLookup.has(bestLabel)) {
                    newTrack = visibleIndexLookup.get(bestLabel)!;
                }

                if (node.track !== newTrack) changed = true;
                return { ...node, track: newTrack };
            });

            if (!changed) return prev;
            return { ...prev, nodes: newNodes };
        });
    }, [visibleRowLabels, activeAttribute, rowLabelMap]);


    // --- ACTIONS ---

    const setGraphData = (nodes: NarrativeNode[], sources: Source[] = []) => {
        const nextAvailableAttributes = new Set(availableAttributes);
        const nextRowLabelMap = { ...rowLabelMap };

        // 1. Analyze incoming data to extract actual tracks
        const incomingAttrValues: Record<string, Set<string>> = {};

        nodes.forEach(node => {
            Object.entries(node.attributes).forEach(([attr, values]) => {
                nextAvailableAttributes.add(attr);
                if (!incomingAttrValues[attr]) incomingAttrValues[attr] = new Set();
                values.forEach(v => incomingAttrValues[attr].add(v));
            });
        });

        // 2. Update Map - OVERWRITE existing keys if they exist in data
        Object.entries(incomingAttrValues).forEach(([attr, valueSet]) => {
            nextRowLabelMap[attr] = Array.from(valueSet);
        });

        // 3. Update State
        setAvailableAttributes(Array.from(nextAvailableAttributes));
        setRowLabelMap(nextRowLabelMap);
        setHiddenLabels([]); // Clear visibility filters as labels have changed

        // 4. Update Grid Dimensions
        const maxTime = nodes.length > 0 ? Math.max(...nodes.map(n => n.time)) : 0;
        setGridCols(Math.max(maxTime + 1, DEFAULT_COLS_COUNT));

        setGraph({ nodes, edges: [], sources });
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

        if (Object.keys(pendingRowUpdates).length > 0) {
            setRowLabelMap(oldMap => {
                const current = [...(oldMap[activeAttribute] || [])];
                Object.entries(pendingRowUpdates).forEach(([hStr, val]) => {
                    const hIndex = parseInt(hStr);
                    const visibleLabel = visibleRowLabels[hIndex];
                    const masterIdx = current.indexOf(visibleLabel);
                    if (masterIdx !== -1) current[masterIdx] = val;
                });
                return { ...oldMap, [activeAttribute]: current };
            });
        }

        setGraph(prev => ({ ...prev, nodes: [...prev.nodes, ...newNodes] }));
    };

    const addManualNode = (t: number, h: number) => {
        const activeRowLabels = visibleRowLabels;
        if (h >= activeRowLabels.length || t >= gridCols) return;

        let rowValue = activeRowLabels[h];
        if (!rowValue) {
            rowValue = `${activeAttribute} ${h + 1}`;
            updateRowLabel(h, rowValue);
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

        setGraph(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    };

    const moveNode = (nodeId: string, t: number, h: number) => {
        setGraph(prev => {
            const node = prev.nodes.find(n => n.id === nodeId);
            if (!node) return prev;

            if (h >= visibleRowLabels.length || t >= gridCols) return prev;

            const activeRowLabels = visibleRowLabels;
            let rowValue = activeRowLabels[h];

            if (!rowValue) {
                rowValue = `${activeAttribute} ${h + 1}`;
                updateRowLabel(h, rowValue);
            }

            const newAttributes = { ...node.attributes };
            const currentAttrs = newAttributes[activeAttribute] || [];
            const filteredAttrs = currentAttrs.filter(a => a !== rowValue);
            newAttributes[activeAttribute] = [rowValue, ...filteredAttrs];

            const updatedNodes = prev.nodes.map(n =>
                n.id === nodeId ? { ...n, time: t, track: h, attributes: newAttributes } : n
            );

            return { ...prev, nodes: updatedNodes };
        });
    };

    const updateNode = (id: string, data: { attributes: Record<string, string[]>, content: string }) => {
        setGraph(prev => ({
            ...prev,
            nodes: prev.nodes.map(n => {
                if (n.id !== id) return n;
                return { ...n, attributes: data.attributes, content: data.content };
            })
        }));
    };

    const deleteNode = (id: string) => {
        setGraph(prev => ({
            ...prev,
            nodes: prev.nodes.filter(n => n.id !== id)
        }));
    };

    const updateRowLabel = (index: number, newValue: string) => {
        const oldLabel = visibleRowLabels[index];

        setRowLabelMap(prev => {
            const current = [...(prev[activeAttribute] || [])];
            const masterIndex = current.indexOf(oldLabel);
            if (masterIndex !== -1) {
                current[masterIndex] = newValue;
            }
            return { ...prev, [activeAttribute]: current };
        });

        setGraph(prev => ({
            ...prev,
            nodes: prev.nodes.map(n => {
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
            })
        }));
    };

    const createTrack = (value: string) => {
        setRowLabelMap(prev => {
            const current = prev[activeAttribute] || [];
            if (!current.includes(value)) {
                return { ...prev, [activeAttribute]: [...current, value] };
            }
            return prev;
        });
    };

    const deleteTrack = (label: string) => {
        setRowLabelMap(prev => {
            const current = prev[activeAttribute] || [];
            return { ...prev, [activeAttribute]: current.filter(l => l !== label) };
        });
        setHiddenLabels(prev => prev.filter(l => l !== label));
        setGraph(prev => ({
            ...prev,
            nodes: prev.nodes.map(n => {
                const attrs = n.attributes[activeAttribute] || [];
                if (attrs.includes(label)) {
                    const newAttrs = attrs.filter(v => v !== label);
                    return { ...n, attributes: { ...n.attributes, [activeAttribute]: newAttrs } };
                }
                return n;
            })
        }));
    };

    const reorderTracks = (newOrder: string[]) => {
        const oldVisibleLabels = [...visibleRowLabels];

        setRowLabelMap(prev => {
            // newOrder is the full list of tracks provided by TrackPanel
            return { ...prev, [activeAttribute]: newOrder };
        });

        // After rowLabelMap updates, visibleRowLabels will update.
        // We need to update node tracks to match their labels' new positions.
        setGraph(prev => {
            const newVisibleLabels = newOrder.filter(l => !l || !hiddenLabels.includes(l));

            return {
                ...prev,
                nodes: prev.nodes.map(n => {
                    const label = oldVisibleLabels[n.track];
                    const newIndex = newVisibleLabels.indexOf(label);
                    if (newIndex !== -1 && newIndex !== n.track) {
                        return { ...n, track: newIndex };
                    }
                    return n;
                })
            };
        });
    };

    const toggleTrackVisibility = (label: string) => {
        setHiddenLabels(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
    };

    const addAttribute = (attr: string) => {
        if (!availableAttributes.includes(attr)) {
            setAvailableAttributes(prev => [...prev, attr]);
            setRowLabelMap(prev => ({
                ...prev,
                [attr]: Array(DEFAULT_ROWS_COUNT).fill('').map((_, i) => `${attr} ${i + 1}`)
            }));
        }
    };

    const deleteAttribute = (attr: string) => {
        if (availableAttributes.length <= 1) return;
        const newAttrs = availableAttributes.filter(a => a !== attr);
        setAvailableAttributes(newAttrs);

        if (activeAttribute === attr) setActiveAttribute(newAttrs[0]);
        if (linkingAttribute === attr) setLinkingAttribute(newAttrs[0]);

        setRowLabelMap(prev => {
            const next = { ...prev };
            delete next[attr];
            return next;
        });

        setGraph(prev => ({
            ...prev,
            nodes: prev.nodes.map(n => {
                const newAttributes = { ...n.attributes };
                delete newAttributes[attr];
                return { ...n, attributes: newAttributes };
            })
        }));
    };

    const adjustGrid = (type: 'rows' | 'cols', delta: number) => {
        if (type === 'cols') {
            setGridCols(Math.max(1, gridCols + delta));
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
        setGraph({ nodes: [], edges: [], sources: [] });
        setHiddenLabels([]);
        setRowLabelMap(prev => ({
            ...prev,
            [activeAttribute]: Array(DEFAULT_ROWS_COUNT).fill('').map((_, i) => `${activeAttribute} ${i + 1}`)
        }));
    };

    useEffect(() => { setHiddenLabels([]); }, [activeAttribute]);

    return (
        <GraphContext.Provider value={{
            graph, gridConfig, availableAttributes, activeAttribute, linkingAttribute,
            rowLabelMap, hiddenLabels, visibleRowLabels,
            setGraphData, addMotifToGraph, addManualNode, moveNode, updateNode, deleteNode,
            setActiveAttribute, setLinkingAttribute, addAttribute, deleteAttribute,
            updateRowLabel, reorderTracks, toggleTrackVisibility, createTrack, deleteTrack,
            adjustGrid, clearGraph
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
