export class MCPDecisionEngine {
  selectAgent(input: {
    query: string;
    vectorResults: any[];
    graphNodes: string[];
    agents: any[];
  }) {
    const { vectorResults, graphNodes, agents } = input;

    // 🔷 compute global context signals
    const vectorStrength =
      vectorResults.length > 0
        ? vectorResults.reduce((s, v) => s + v.score, 0) / vectorResults.length
        : 0;

    const graphStrength =
      graphNodes.length > 0 ? Math.min(graphNodes.length / 10, 1) : 0;

    let best = agents[0];
    let bestScore = -Infinity;

    const scoredAgents = agents.map((agent) => {
      let score = 0;

      // 🔷 1. capability matching (core MCP intelligence layer)
      if (agent.capabilities?.includes("ai_evaluation_0_100")) {
        score += 0.35 * vectorStrength;
      }

      if (agent.capabilities?.includes("infrastructure_monitoring")) {
        score += 0.25 * graphStrength;
      }

      if (agent.capabilities?.includes("identity_verification")) {
        score += 0.15;
      }

      // 🔷 2. MCP layer priority weighting
      if (agent.mcp_layer === "control") {
        score += 0.2;
      }

      if (agent.mcp_layer === "observability") {
        score += 0.1;
      }

      // 🔷 3. vector alignment boost
      score += vectorStrength * 0.3;

      // 🔷 4. graph structural boost
      score += graphStrength * 0.2;

      return { agent, score };
    });

    // 🔷 select best agent
    for (const item of scoredAgents) {
      if (item.score > bestScore) {
        bestScore = item.score;
        best = item.agent;
      }
    }

    return {
      ...best,
      score: bestScore,
      vectorStrength,
      graphStrength,
    };
  }
}
