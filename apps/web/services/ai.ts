import { GoogleGenAI, Type } from "@google/genai";
import { NarrativeNode, Source } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// We use an intermediate type for AI generation to avoid dynamic key issues in Schema definition
interface AIResponseNode {
  time: number;
  track: number;
  content: string;
  attributes: { key: string; values: string[] }[];
}

export const generateGraphFromPrompt = async (
  userPrompt: string,
  currentAttributes: string[],
  gridRows: number,
  gridCols: number,
  useSearch: boolean
): Promise<{
  nodes: NarrativeNode[];
  sources: Source[];
  recommendedRows: number;
  recommendedCols: number;
}> => {
  // Using gemini-3-flash-preview which supports search grounding
  const modelId = "gemini-3-flash-preview";

  const systemInstruction = `
    You are an experienced journalist.
    Your task is to generate a narrative graph that fits strictly into a ${gridCols} (Time) x ${gridRows} (Track) grid.
    
    ${
      useSearch
        ? "MODE: REAL NEWS. Use Google Search to find factual events."
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
       
    
    Output strictly compliant JSON.
  `;

  const tools = useSearch ? [{ googleSearch: {} }] : undefined;

  const response = await ai.models.generateContent({
    model: modelId,
    config: {
      systemInstruction: systemInstruction,
      tools: tools,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nodes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: {
                  type: Type.INTEGER,
                  description: `Column index (0 to ${gridCols - 1})`,
                },
                track: {
                  type: Type.INTEGER,
                  description: `Row index (0 to ${gridRows - 1})`,
                },
                content: {
                  type: Type.STRING,
                  description:
                    "Simple 5W statement (Who, what, where, when, why)",
                },
                attributes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      key: { type: Type.STRING },
                      values: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                  },
                },
              },
              required: ["time", "track", "content", "attributes"],
            },
          },
        },
      },
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
  });

  const responseText = response.text;
  if (!responseText) throw new Error("No response from AI");

  const data = JSON.parse(responseText) as { nodes: AIResponseNode[] };

  // Extract Grounding Metadata (Sources) - Only if search was used/available
  const sources: Source[] = [];
  if (useSearch) {
    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      groundingChunks.forEach((chunk) => {
        if (chunk.web?.uri && chunk.web?.title) {
          sources.push({
            title: chunk.web.title,
            uri: chunk.web.uri,
          });
        }
      });
    }
  }

  // Deduplicate sources by URI
  const uniqueSources = Array.from(
    new Map(sources.map((s) => [s.uri, s])).values()
  );

  // Transform AI response to App Type
  const finalNodes: NarrativeNode[] = data.nodes.map((n) => {
    const attrRecord: Record<string, string[]> = {};
    n.attributes.forEach((a) => {
      attrRecord[a.key] = a.values;
    });

    return {
      id: crypto.randomUUID(),
      time: n.time,
      track: n.track,
      content: n.content,
      attributes: attrRecord,
      motifSource: useSearch ? "AI Search" : "AI Creative",
    };
  });

  return {
    nodes: finalNodes,
    sources: uniqueSources,
    recommendedRows: gridRows,
    recommendedCols: gridCols,
  };
};
