/**
 * MCP Explanation Engine
 * Converts raw decision signals into human-readable + machine-auditable reasoning
 */

type ExplanationInput = {
  query: string;
  selectedAgent: {
    id: string;
    alias: string;
    mcp_layer: string;
  };
  vectorResults: { id: string; score: number }[];
  graphNodes: { id: string; weight?: number }[];
  agentScores?: Record<string, number>;
};

type ExplanationOutput = {
  selectedAgent: string;
  confidence: number;
  mode: "vector-dominant" | "graph-dominant" | "hybrid";
  reasoning: string;
  breakdown: {
    vectorStrength: number;
    graphStrength: number;
    agentBias: string[];
  };
};

export class MCPExplanationEngine {
  explain(input: ExplanationInput): ExplanationOutput {
    const { selectedAgent, vectorResults, graphNodes } = input;

    // 🔷 VECTOR STRENGTH
    const vectorStrength =
      vectorResults.length > 0
        ? vectorResults.reduce((sum, v) => sum + v.score, 0) /
          vectorResults.length
        : 0;

    // 🔷 GRAPH STRENGTH
    const graphStrength =
      graphNodes.length > 0
        ? graphNodes.reduce((sum, g) => sum + (g.weight ?? 0.5), 0) /
          graphNodes.length
        : 0;

    // 🔷 MODE CLASSIFICATION
    let mode: "vector-dominant" | "graph-dominant" | "hybrid" = "hybrid";

    if (vectorStrength > 0.85) {
      mode = "vector-dominant";
    } else if (graphStrength > 0.7) {
      mode = "graph-dominant";
    }

    // 🔷 AGENT BIAS DETECTION
    const agentBias: string[] = [];

    if (selectedAgent.mcp_layer === "control") {
      agentBias.push("control-layer-priority");
    }
    if (selectedAgent.mcp_layer === "evaluation") {
      agentBias.push("evaluation-optimization-bias");
    }
    if (selectedAgent.mcp_layer === "observability") {
      agentBias.push("monitoring-awareness-bias");
    }

    // 🔷 CONFIDENCE CALCULATION
    const confidence = Math.min(
      0.95,
      (vectorStrength * 0.5 + graphStrength * 0.3 + 0.2)
    );

    // 🔷 FINAL REASONING STRING
    const reasoning = `
Agent selected based on MCP multi-layer evaluation:
- Vector signal strength: ${vectorStrength.toFixed(3)}
- Graph structural strength: ${graphStrength.toFixed(3)}
- MCP layer bias: ${selectedAgent.mcp_layer}
- Decision mode: ${mode}
    `.trim();

    return {
      selectedAgent: selectedAgent.id,
      confidence,
      mode,
      reasoning,
      breakdown: {
        vectorStrength,
        graphStrength,
        agentBias
      }
    };
  }
}
