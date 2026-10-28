export interface NarrativeNode {
  id: string;
  label?: string; // Persistent label (e.g., v1, v2)
  time: number; // The T axis (column)
  track: number; // The H axis (row)
  motifSource?: string; // Which motif created this, purely for metadata
  attributes: Record<string, string[]>; // Dynamic attributes (e.g. { Entity: ['CEO A'], Topic: ['Finance', 'Tech'] })
  content?: string; // The narrative statement/paragraph
}

export interface NarrativeEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface Source {
  title: string;
  uri: string;
}

export interface NarrativeGraph {
  nodes: NarrativeNode[];
  edges: NarrativeEdge[];
  sources?: Source[];
}

export interface MotifNodeTemplate {
  relTime: number;
  relTrack: number;
}

export interface MotifEdgeTemplate {
  sourceIndex: number;
  targetIndex: number;
}

export interface Motif {
  id: string;
  name: string;
  category: "Sequential" | "Non-Sequential";
  description: string;
  nodes: MotifNodeTemplate[];
  edges: MotifEdgeTemplate[];
}
