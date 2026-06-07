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
    capabilities?: string[];
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
    confidenceComponents: {
      vector: number;
      graph: number;
      prior: number;
    };
    agentBias: string[];
  };
};

export class MCPExplanationEngine {
  explain(input: ExplanationInput): ExplanationOutput {
    const { selectedAgent, vectorResults, graphNodes } = input;

    // =========================================================
    // 🔷 VECTOR STRENGTH (weighted normalization)
    // =========================================================
    const vectorStrength =
      vectorResults.length > 0
        ? vectorResults.reduce((sum, v) => sum + v.score, 0) /
          Math.max(vectorResults.length, 1)
        : 0;

    // =========================================================
    // 🔷 GRAPH STRENGTH (edge influence normalized)
    // =========================================================
    const graphStrength =
      graphNodes.length > 0
        ? graphNodes.reduce((sum, g) => sum + (g.weight ?? 0.5), 0) /
          Math.max(graphNodes.length, 1)
        : 0;

    // =========================================================
    // 🔷 MODE CLASSIFICATION (MCP routing logic)
    // =========================================================
    let mode: "vector-dominant" | "graph-dominant" | "hybrid" = "hybrid";

    if (vectorStrength >= 0.85 && vectorStrength > graphStrength) {
      mode = "vector-dominant";
    } else if (graphStrength >= 0.75 && graphStrength > vectorStrength) {
      mode = "graph-dominant";
    }

    // =========================================================
    // 🔷 AGENT BIAS DETECTION (expanded logic)
    // =========================================================
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

    // capability-based bias (IMPORTANT IMPROVEMENT)
    if (selectedAgent.capabilities?.includes("identity_verification")) {
      agentBias.push("identity-confidence-weighted");
    }

    if (selectedAgent.capabilities?.includes("ai_evaluation_0_100")) {
      agentBias.push("scoring-optimization-bias");
    }

    // =========================================================
    // 🔷 CONFIDENCE MODEL (normalized MCP scoring)
    // =========================================================
    const vectorComponent = vectorStrength * 0.5;
    const graphComponent = graphStrength * 0.3;
    const priorComponent = 0.2;

    const confidence = Math.min(
      0.97,
      vectorComponent + graphComponent + priorComponent
    );

    // =========================================================
    // 🔷 FINAL REASONING TRACE (structured + audit-friendly)
    // =========================================================
    const reasoning = `
[MCP DECISION EXPLANATION]

Agent: ${selectedAgent.id}
Alias: ${selectedAgent.alias}
Layer: ${selectedAgent.mcp_layer}

Signals:
- Vector Strength: ${vectorStrength.toFixed(4)}
- Graph Strength: ${graphStrength.toFixed(4)}
- Mode: ${mode}

Interpretation:
- Vector signal contributed semantic relevance scoring
- Graph signal contributed structural relationship weighting
- MCP layer influenced execution priority context
    `.trim();

    // =========================================================
    // 🔷 RETURN STRUCTURED OUTPUT
    // =========================================================
    return {
      selectedAgent: selectedAgent.id,
      confidence,
      mode,
      reasoning,
      breakdown: {
        vectorStrength,
        graphStrength,
        confidenceComponents: {
          vector: vectorComponent,
          graph: graphComponent,
          prior: priorComponent,
        },
        agentBias,
      },
    };
  }
}
