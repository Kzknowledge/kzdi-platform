export class MCPDecisionEngine {
  selectAgent(input: {
    query: string;
    vectorResults: any[];
    graphNodes: string[];
    agents: any[];
  }) {
    const { vectorResults, graphNodes, agents } = input;

    let best = agents[0];
    let bestScore = 0;

    for (const agent of agents) {
      let score = 0;

      // vector influence
      score += vectorResults.reduce((s, v) => s + v.score, 0) * 0.4;

      // graph influence
      score += graphNodes.length * 0.2;

      // capability bonus
      if (agent.capabilities?.includes("ai_evaluation_0_100")) {
        score += 0.3;
      }

      if (score > bestScore) {
        bestScore = score;
        best = agent;
      }
    }

    return {
      ...best,
      score: bestScore,
    };
  }
}
