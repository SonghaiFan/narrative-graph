import { NarrativeNode, Source } from "../types";

// AI graph generation through OpenRouter: one key, many models, the OpenAI chat-completions protocol.
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "google/gemini-3-flash-preview";
// A few ids to start from; any id on https://openrouter.ai/models can be typed in.
export const SUGGESTED_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
  "anthropic/claude-haiku-5.5",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-chat",
];

// We use an intermediate type for AI generation to avoid dynamic key issues in Schema definition
interface AIResponseNode {
  time: number;
  track: number;
  content: string;
  attributes: { key: string; values: string[] }[] | Record<string, string[]>;
}

export interface GenerateResult {
  nodes: NarrativeNode[];
  sources: Source[];
  recommendedRows: number;
  recommendedCols: number;
}

export const buildSystemInstruction = (gridRows: number, gridCols: number, useSearch: boolean): string => `
    You are an experienced journalist.
    Your task is to generate a narrative graph that fits strictly into a ${gridCols} (Time) x ${gridRows} (Track) grid.
    
    ${
      useSearch
        ? "MODE: REAL NEWS. Use web search to find factual events."
        : "MODE: CREATIVE FICTION. Generate a coherent fictional story based on the prompt."
    }

    CRITICAL GOAL: AVOID LINEAR PARALLEL LINES. YOU MUST CREATE INTERACTIONS.
    - A "Linear" graph has tracks that never interact. THIS IS BAD.
    - A "Complex" graph has Branching (one node connects to multiple tracks) and Merging (multiple tracks converge to one node). THIS IS GOOD.
    - To create connections, nodes at time T and T+1 must share values in their attributes (specifically Entities or Topics).

    STRICT ATTRIBUTE CONSTRAINTS:
    1. 'Entity' and 'Topic':
       - Map 'Entity' or 'Topic' to the Track axis (Rows 0 to ${gridRows - 1}).
       - MAXIMUM ${gridRows} unique values for 'Entity'.
       - MAXIMUM ${gridRows} unique values for 'Topic'.
       - REUSE these values frequently.
    
    ${
      useSearch
        ? `2. 'Time Period' (COMPULSORY for Real News):
       - You MUST include a 'Time Period' attribute for every node.
       - Divide the timeline into exactly ${gridCols} distinct periods (e.g., "Jan 2024", "Feb 2024", "Mar 2024" OR "2020", "2021", "2022").
       - All nodes in column 0 MUST have the 1st period value.
       - All nodes in column 1 MUST have the 2nd period value.
       - And so on, up to column ${gridCols - 1}.`
        : ""
    }

    GRID CONSTRAINTS:
    - Columns (Time): Strictly 0 to ${gridCols - 1}.
    - Rows (Tracks): Strictly 0 to ${gridRows - 1}.
    
    INSTRUCTIONS:
    
    1. TIME BINNING (Columns):
       - Assign events to columns 0 through ${gridCols - 1}.
       ${
         useSearch
           ? "- Ensure the 'Time Period' attribute matches the column index."
           : ""
       }
    
    2. TRACK BINNING (Rows):
       - Identify exactly ${gridRows} primary themes/entities (Track 0 to ${
    gridRows - 1
  }).
       - Assign events to these tracks.
    
    3. CONTENT STYLE (5Ws):
       - 'content' must be a SIMPLE, STANDALONE STATEMENT describing a single specific event.
       - Use the 5Ws style: Who did What, Where, When, and Why.
       - Keep it concise (under 20 words).
    
    4. ATTRIBUTES & LINKING (MANDATORY):
       - 'attributes' object MUST contain: 'Entity' and 'Topic'.
       ${
         useSearch
           ? "- Include 'Time Period' and 'Date' attributes (use real dates found via search)."
           : ""
       }
        - multiple values for 'Entity' is allowed and encouraged to create links.
       
    
    Output strictly compliant JSON and nothing else, in exactly this shape:
    {"nodes": [{"time": 0, "track": 0, "content": "...", "attributes": [{"key": "Entity", "values": ["..."]}]}]}
  `;

const responseSchema = (gridRows: number, gridCols: number) => ({
  type: "object",
  additionalProperties: false,
  required: ["nodes"],
  properties: {
    nodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["time", "track", "content", "attributes"],
        properties: {
          time: { type: "integer", description: `Column index (0 to ${gridCols - 1})` },
          track: { type: "integer", description: `Row index (0 to ${gridRows - 1})` },
          content: { type: "string", description: "Simple 5W statement (Who, what, where, when, why)" },
          attributes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["key", "values"],
              properties: { key: { type: "string" }, values: { type: "array", items: { type: "string" } } },
            },
          },
        },
      },
    },
  },
});

/** The body of the request. Real-news mode turns on OpenRouter's web search plugin. */
export const buildRequestBody = (
  userPrompt: string,
  gridRows: number,
  gridCols: number,
  useSearch: boolean,
  model: string
) => ({
  model,
  messages: [
    { role: "system", content: buildSystemInstruction(gridRows, gridCols, useSearch) },
    { role: "user", content: userPrompt },
  ],
  response_format: {
    type: "json_schema",
    json_schema: { name: "narrative_graph", strict: true, schema: responseSchema(gridRows, gridCols) },
  },
  ...(useSearch ? { plugins: [{ id: "web" }] } : {}),
});

/** Models do not all obey "JSON only": drop a code fence or a sentence around the object. */
export const extractJson = (text: string): unknown => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The model did not return JSON.");
  return JSON.parse(text.slice(start, end + 1));
};

/** Web pages the model cited, from OpenRouter's url_citation annotations, once each. */
export const extractSources = (message: any): Source[] => {
  const found = new Map<string, Source>();
  for (const a of message?.annotations ?? []) {
    const c = a?.type === "url_citation" ? a.url_citation : null;
    if (c?.url && !found.has(c.url)) found.set(c.url, { title: c.title || c.url, uri: c.url });
  }
  return Array.from(found.values());
};

export const toNodes = (data: { nodes?: AIResponseNode[] }, useSearch: boolean): NarrativeNode[] => {
  if (!Array.isArray(data.nodes)) throw new Error("The model's JSON has no nodes list.");
  return data.nodes.map((n) => {
    const attrRecord: Record<string, string[]> = Array.isArray(n.attributes)
      ? Object.fromEntries(n.attributes.map((a) => [a.key, a.values]))
      : { ...(n.attributes ?? {}) };
    return {
      id: crypto.randomUUID(),
      time: n.time,
      track: n.track,
      content: n.content,
      attributes: attrRecord,
      motifSource: useSearch ? "AI Search" : "AI Creative",
    };
  });
};

export const generateGraphFromPrompt = async (
  userPrompt: string,
  currentAttributes: string[],
  gridRows: number,
  gridCols: number,
  useSearch: boolean,
  apiKey: string,
  model: string = DEFAULT_MODEL,
  fetchImpl: typeof fetch = fetch
): Promise<GenerateResult> => {
  const key = apiKey.trim();
  if (!key) throw new Error("Enter an OpenRouter API key to generate a graph.");
  const modelId = model.trim();
  if (!modelId) throw new Error("Enter a model id, for example " + DEFAULT_MODEL + ".");

  const response = await fetchImpl(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildRequestBody(userPrompt, gridRows, gridCols, useSearch, modelId)),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const reason = payload?.error?.message || response.statusText || "request failed";
    throw new Error(`OpenRouter ${payload?.error?.code ?? response.status}: ${reason}`);
  }

  const message = payload?.choices?.[0]?.message;
  const text: string | undefined = message?.content;
  if (!text) throw new Error("No response from AI");

  return {
    nodes: toNodes(extractJson(text) as { nodes?: AIResponseNode[] }, useSearch),
    sources: useSearch ? extractSources(message) : [],
    recommendedRows: gridRows,
    recommendedCols: gridCols,
  };
};
