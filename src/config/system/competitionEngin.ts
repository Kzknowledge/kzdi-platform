export class MCPCompetitionEngine {
  run(input: {
    query: string;
    vectorResults: any[];
    graphNodes: string[];
    agents: any[];
  }) {
    const { vectorResults, graphNodes, agents } = input;

    const vectorScore = vectorResults.reduce((s, v) => s + v.score, 0);
    const graphScore = graphNodes.length;

    const ranking = agents.map((agent) => {
      let score = 0;

      score += vectorScore * 0.4;
      score += graphScore * 0.2;

      if (agent.capabilities?.includes("ai_evaluation_0_100")) {
        score += 0.3;
      }

      if (agent.mcp_layer === "evaluation") score += 0.25;
      if (agent.mcp_layer === "control") score += 0.15;
      if (agent.mcp_layer === "observability") score += 0.1;

      return { agent, score };
    });

    ranking.sort((a, b) => b.score - a.score);

    return {
      winner: ranking[0],
      ranking,
    };
  }
}
