import { Motif } from "./types";

// --- VISUAL CONSTANTS ---
export const CELL_WIDTH = 100;
export const CELL_HEIGHT = 85;
export const LABEL_WIDTH = 200;
export const NODE_DIAMETER = 45;
export const RIGHT_MARGIN = 120;

// --- GRID & GRAPH DEFAULTS ---
export const DEFAULT_ROWS_COUNT = 3;
export const DEFAULT_COLS_COUNT = 5;

export const DEFAULT_ATTRIBUTES = [
  "Topic",
  "Entity",
  "Sentiment",
  "Date",
  "Time Period",
];
export const INITIAL_AXIS = "Topic";
export const INITIAL_LINKING = "Entity";

export const TEMPORAL_KEYS = [
  "Date",
  "Time Period",
  "Time",
  "Year",
  "Month",
  "Day",
  "Timestamp",
];

// Tableau 10 Color Palette
export const TRACK_PALETTE = [
  "#4E79A7", // Blue
  "#F28E2B", // Orange
  "#E15759", // Red
  "#76B7B2", // Cyan
  "#59A14F", // Green
  "#EDC948", // Yellow
  "#B07AA1", // Purple
  "#FF9DA7", // Pink
  "#9C755F", // Brown
  "#BAB0AC", // Grey
];

export const getTrackColor = (label: string) => {
  if (!label) return TRACK_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TRACK_PALETTE[Math.abs(hash) % TRACK_PALETTE.length];
};

// --- MOTIF DEFINITIONS ---
export const NARRATIVE_MOTIFS: Motif[] = [
  // --- Sequential ---
  {
    id: "linear",
    name: "Linear",
    category: "Sequential",
    description:
      "Announcements within single track, showing that the organising attribute remains most significant.",
    nodes: [
      { relTime: 0, relTrack: 0 },
      { relTime: 1, relTrack: 0 },
      { relTime: 2, relTrack: 0 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1 },
      { sourceIndex: 1, targetIndex: 2 },
    ],
  },
  {
    id: "arch",
    name: "Arch",
    category: "Sequential",
    description:
      "Narrative briefly transitions to another track when a shared attribute becomes significant, then returns.",
    nodes: [
      { relTime: 0, relTrack: 0 },
      { relTime: 1, relTrack: 1 },
      { relTime: 2, relTrack: 0 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1 },
      { sourceIndex: 1, targetIndex: 2 },
    ],
  },
  {
    id: "ladder",
    name: "Ladder",
    category: "Sequential",
    description:
      "Narrative progressively moves across tracks as different attributes gain significance.",
    nodes: [
      { relTime: 0, relTrack: 0 },
      { relTime: 1, relTrack: 1 },
      { relTime: 2, relTrack: 2 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1 },
      { sourceIndex: 1, targetIndex: 2 },
    ],
  },
  {
    id: "early_turn",
    name: "EarlyTurn",
    category: "Sequential",
    description:
      "A shared attribute quickly becomes significant, causing an early track transition that persists.",
    nodes: [
      { relTime: 0, relTrack: 0 },
      { relTime: 1, relTrack: 1 },
      { relTime: 2, relTrack: 1 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1 },
      { sourceIndex: 1, targetIndex: 2 },
    ],
  },
  {
    id: "late_turn",
    name: "LateTurn",
    category: "Sequential",
    description:
      "The organising attribute remains dominant before a late transition when a shared attribute becomes significant.",
    nodes: [
      { relTime: 0, relTrack: 0 },
      { relTime: 1, relTrack: 0 },
      { relTime: 2, relTrack: 1 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1 },
      { sourceIndex: 1, targetIndex: 2 },
    ],
  },

  // --- Non-Sequential ---
  {
    id: "sharp_branch",
    name: "SharpBranch",
    category: "Non-Sequential",
    description:
      "An Announcement connects to two adjacent tracks because it has multiple significant attributes.",
    nodes: [
      { relTime: 0, relTrack: 0 }, // Source
      { relTime: 1, relTrack: 0 }, // Target 1 (Same track)
      { relTime: 1, relTrack: 1 }, // Target 2 (Adjacent track)
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1 },
      { sourceIndex: 0, targetIndex: 2 },
    ],
  },
  {
    id: "wide_branch",
    name: "WideBranch",
    category: "Non-Sequential",
    description:
      "An Announcement connects to distant tracks due to strongly contrasting attributes.",
    nodes: [
      { relTime: 0, relTrack: 1 }, // Source (Middle track)
      { relTime: 1, relTrack: 0 }, // Target 1 (Upper track)
      { relTime: 1, relTrack: 2 }, // Target 2 (Lower track)
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1 },
      { sourceIndex: 0, targetIndex: 2 },
    ],
  },
  {
    id: "sharp_merge",
    name: "SharpMerge",
    category: "Non-Sequential",
    description:
      "Announcements from adjacent tracks converge when they share a significant attribute.",
    nodes: [
      { relTime: 0, relTrack: 0 }, // Source 1 (h_i)
      { relTime: 0, relTrack: 1 }, // Source 2 (h_{i+1})
      { relTime: 1, relTrack: 0 }, // Target (h_i)
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 2 },
      { sourceIndex: 1, targetIndex: 2 },
    ],
  },
  {
    id: "wide_merge",
    name: "WideMerge",
    category: "Non-Sequential",
    description:
      "Announcements from distant tracks converge when they develop a strong shared attribute.",
    nodes: [
      { relTime: 0, relTrack: 0 }, // Source 1 (h_i)
      { relTime: 0, relTrack: 2 }, // Source 2 (h_{i+2})
      { relTime: 1, relTrack: 1 }, // Target (h_{i+1})
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 2 },
      { sourceIndex: 1, targetIndex: 2 },
    ],
  },
];
