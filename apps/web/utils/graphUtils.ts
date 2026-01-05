import { NarrativeNode } from "../types";

export interface CytoscapeEdge {
  data: {
    id: string;
    source: string;
    target: string;
    type: "track" | "attribute";
  };
}

/**
 * Computes edges for Cytoscape views (DAG, Force, etc.)
 * 1. Attribute Connections (Solid): Strictly T -> T+1 if they share attributes.
 * 2. Track Connections (Dashed): Sequential connections within the same track (a -> b -> c).
 */
export const computeCytoscapeEdges = (
  nodes: NarrativeNode[],
  linkingAttribute: string,
  edgeIdPrefix: string = "edge"
): CytoscapeEdge[] => {
  const edges: CytoscapeEdge[] = [];
  const edgeIds = new Set<string>();

  const addEdge = (uId: string, vId: string, type: "track" | "attribute") => {
    const id = `${edgeIdPrefix}-${uId}-${vId}`;
    // If an edge already exists, we don't add another one.
    // By adding 'attribute' edges first, they take precedence (solid over dashed).
    if (!edgeIds.has(id)) {
      edgeIds.add(id);
      edges.push({
        data: {
          id,
          source: uId,
          target: vId,
          type,
        },
      });
    }
  };

  // 1. Attribute Connections: Connect nodes in adjacent time steps (T -> T+1) if they share attributes
  // These are SOLID edges. We add them first so they take precedence over track edges.
  const nodesByTime: Record<number, NarrativeNode[]> = {};
  nodes.forEach((n) => {
    if (!nodesByTime[n.time]) nodesByTime[n.time] = [];
    nodesByTime[n.time].push(n);
  });

  const times = Object.keys(nodesByTime)
    .map(Number)
    .sort((a, b) => a - b);

  for (const t of times) {
    const currentNodes = nodesByTime[t];
    const nextNodes = nodesByTime[t + 1]; // Strictly T+1

    if (nextNodes) {
      currentNodes.forEach((u) => {
        nextNodes.forEach((v) => {
          const uAttrs = u.attributes[linkingAttribute] || [];
          const vAttrs = v.attributes[linkingAttribute] || [];
          const isConnected = uAttrs.some((val) => vAttrs.includes(val));

          if (isConnected) {
            addEdge(u.id, v.id, "attribute");
          }
        });
      });
    }
  }

  // 2. Track Connections: Connect nodes in the same track sequentially
  // These are DASHED edges.
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
      addEdge(trackNodes[i].id, trackNodes[i + 1].id, "track");
    }
  });

  return edges;
};
