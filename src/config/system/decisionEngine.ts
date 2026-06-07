import { getSystemBias } from "./system-memory";

type VectorResult = {
  id: string;
  score: number;
};

type Agent = {
  id: string;
  alias: string;
  capabilities: string[];
  mcp_layer: string;
};

export class MCPDecisionEngine {
  /**
   * MEMORY-AWARE AGENT SELECTION ENGINE
   */
  async selectAgent(input: {
    query: string;
    vectorResults: VectorResult[];
    graphNodes: string[];
    agents: Agent[];
  }) {
    const { vectorResults, graphNodes, agents } = input;

    // 🧠 STEP 1: LOAD SYSTEM MEMORY BIAS
    const memory = await getSystemBias();

    const vectorWeight =
      memory?.vectorWeights?.bias === "increase" ? 0.6 : 0.4;

    const agentPolicy = memory?.agentPolicy || {};

    let bestAgent: any = agents[0];
    let bestScore = -Infinity;

    // 🧠 STEP 2: SCORE EACH AGENT
    for (const agent of agents) {
      let score = 0;

      // 🔷 VECTOR SIGNAL CONTRIBUTION
      const vectorScore =
        vectorResults.reduce((s, v) => s + v.score, 0) *
        vectorWeight;

      score += vectorScore;

      // 🔷 GRAPH SIGNAL CONTRIBUTION
      score += graphNodes.length * 0.2;

      // 🔷 CAPABILITY BOOST
      if (agent.capabilities?.includes("ai_evaluation_0_100")) {
        score += 0.3;
      }

      if (agent.capabilities?.includes("infrastructure_monitoring")) {
        score += 0.2;
      }

      // 🧠 STEP 3: MEMORY-BASED AGENT BIAS
      const historicalBias = agentPolicy?.[agent.id] || 0.5;
      score += historicalBias * 0.4;

      // 🔷 TRACK BEST AGENT
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    // 🧠 STEP 4: RETURN ENHANCED DECISION
    return {
      ...bestAgent,
      score: bestScore,
      memoryInfluenced: true,
      vectorWeightUsed: vectorWeight,
    };
  }
}
