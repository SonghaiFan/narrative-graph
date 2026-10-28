import { NarrativeNode, NarrativeEdge } from "../types";

export interface CytoscapeEdge {
  data: {
    id: string;
    source: string;
    target: string;
    type: "explicit" | "implicit";
    subtype?: "same" | "cross";
  };
}

export const getStackLabel = (nodes: NarrativeNode[]): string => {
  const labels = nodes.map((n) => n.label || "").filter((l) => l !== "");
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];

  // Try to find a common non-numeric prefix (e.g. "v" in "v1", "v2")
  const firstLabel = labels[0];
  const match = firstLabel.match(/^(\D+)/);
  const prefix = match ? match[1] : "";

  let usePrefix = false;
  if (prefix) {
    usePrefix = labels.every((l) => l.startsWith(prefix));
  }

  if (usePrefix) {
    const suffixes = labels.map((l) => l.substring(prefix.length));
    if (labels.length === 2) {
      return `${prefix}${suffixes.join(",")}`;
    }
    return `${prefix}${suffixes.slice(0, 2).join(",")},..`;
  }

  if (labels.length === 2) return labels.join(",");
  return `${labels.slice(0, 2).join(",")},..`;
};

/**
 * Computes edges for Cytoscape views (DAG, Force, etc.)
 * 1. Explicit Links (Solid/Dashed): Solid for within-track, Dashed for cross-track.
 * 2. Implicit Links (Wide): Visual flow for track connections.
 */
export const computeCytoscapeEdges = (
  nodes: NarrativeNode[],
  explicitEdges: NarrativeEdge[],
  edgeIdPrefix: string = "edge"
): CytoscapeEdge[] => {
  const edges: CytoscapeEdge[] = [];
  const edgeIds = new Set<string>();

  // Map node ID to Track ID for easy lookup
  const nodeTrackMap = new Map<string, number>();
  nodes.forEach((n) => nodeTrackMap.set(n.id, n.track));

  const addEdge = (
    uId: string,
    vId: string,
    type: "explicit" | "implicit",
    subtype?: "same" | "cross"
  ) => {
    // For implicit edges, we use a unique ID including type so they always appear
    // For explicit edges (attribute), we use a shared ID
    const isImplicit = type === "implicit";
    const id = isImplicit
      ? `${edgeIdPrefix}-${type}-${uId}-${vId}`
      : `${edgeIdPrefix}-explicit-${uId}-${vId}`;

    if (!edgeIds.has(id)) {
      edgeIds.add(id);
      edges.push({
        data: {
          id,
          source: uId,
          target: vId,
          type,
          subtype,
        },
      });
    }
  };

  // 1. Attribute Connections: Use the explicit edges from the graph context
  explicitEdges.forEach((edge) => {
    const sTrack = nodeTrackMap.get(edge.sourceId);
    const tTrack = nodeTrackMap.get(edge.targetId);

    // Determine subtype: Same track = solid, Cross track = dashed
    const subtype =
      sTrack !== undefined && tTrack !== undefined && sTrack === tTrack
        ? "same"
        : "cross";

    addEdge(edge.sourceId, edge.targetId, "explicit", subtype);
  });

  // 2. Track Connections: Connect nodes in the same track sequentially
  // These are IMPLICIT edges (visual flow only).
  const nodesByTrack: Record<number, NarrativeNode[]> = {};
  nodes.forEach((n) => {
    if (!nodesByTrack[n.track]) nodesByTrack[n.track] = [];
    nodesByTrack[n.track].push(n);
  });

  Object.values(nodesByTrack).forEach((trackNodes) => {
    // Sort by time to ensure sequential connection
    trackNodes.sort((a, b) => a.time - b.time);
    for (let i = 0; i < trackNodes.length - 1; i++) {
      // Connect a -> b, b -> c (sequential, not a -> c)
      addEdge(trackNodes[i].id, trackNodes[i + 1].id, "implicit");
    }
  });

  return edges;
};

/**
 * Pre-processes nodes to group them by position (Time, Track), creating "Stacked" nodes.
 * Returns a set of unique visual nodes and remapped edges.
 */
export const collapseNodesForVisuals = (
  nodes: NarrativeNode[],
  edges: NarrativeEdge[]
) => {
  const nodesByPos = new Map<string, NarrativeNode[]>();
  const idMap = new Map<string, string>();

  // 1. Group nodes by position (Time, Track)
  nodes.forEach((n) => {
    const key = `${n.time}-${n.track}`;
    if (!nodesByPos.has(key)) nodesByPos.set(key, []);
    nodesByPos.get(key)!.push(n);
  });

  // 2. Create representative nodes
  const visualNodes = Array.from(nodesByPos.values()).map((stack) => {
    const primary = stack[0];
    // Map all original IDs to the primary ID
    stack.forEach((n) => idMap.set(n.id, primary.id));

    // Return a node object that includes stack metadata
    // We attach 'count' and 'stackIds' to the object so they can be read during Cytoscape element creation
    return {
      ...primary,
      label: getStackLabel(stack),
      _stackCount: stack.length,
      _stackIds: stack.map((n) => n.id),
    };
  });

  // 3. Remap edges
  const visualEdges: NarrativeEdge[] = [];
  const seenEdges = new Set<string>();

  edges.forEach((e) => {
    const sourceId = idMap.get(e.sourceId);
    const targetId = idMap.get(e.targetId);

    // Filter out self-loops (edges within the same stack)
    if (sourceId && targetId && sourceId !== targetId) {
      const edgeKey = `${sourceId}-${targetId}`;
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        visualEdges.push({
          id: e.id, // Keep original ID of the first edge found
          sourceId,
          targetId,
        });
      }
    }
  });

  return { visualNodes, visualEdges };
};
