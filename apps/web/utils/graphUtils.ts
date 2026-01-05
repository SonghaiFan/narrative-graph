import { NarrativeNode, NarrativeEdge } from "../types";

export interface CytoscapeEdge {
  data: {
    id: string;
    source: string;
    target: string;
    type: "attribute" | "implicit";
  };
}

/**
 * Computes edges for Cytoscape views (DAG, Force, etc.)
 * 1. Attribute Connections (Solid): Strictly T -> T+1 if they share attributes.
 * 2. Implicit Links (Wide): Visual flow for track connections.
 */
export const computeCytoscapeEdges = (
  nodes: NarrativeNode[],
  explicitEdges: NarrativeEdge[],
  edgeIdPrefix: string = "edge"
): CytoscapeEdge[] => {
  const edges: CytoscapeEdge[] = [];
  const edgeIds = new Set<string>();

  const addEdge = (
    uId: string,
    vId: string,
    type: "attribute" | "implicit"
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
        },
      });
    }
  };

  // 1. Attribute Connections: Use the explicit edges from the graph context (consistent with Grid)
  // These are SOLID edges (visual style defined in component).
  explicitEdges.forEach((edge) => {
    addEdge(edge.sourceId, edge.targetId, "attribute");
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
