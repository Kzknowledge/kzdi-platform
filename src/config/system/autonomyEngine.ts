import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * MCP Autonomy Engine
 * Controlled self-optimization layer (governor-restricted)
 */

export class MCPAutonomyEngine {
  /**
   * Update system learning weights
   */
  async updateSystemWeights(input: {
    vectorWeight: number;
    graphWeight: number;
    agentBias: Record<string, number>;
    traceId?: string;
  }) {
    const { vectorWeight, graphWeight, agentBias, traceId } = input;

    // 🔷 clamp values (SAFETY BOUNDARY)
    const safeVector = Math.min(0.9, Math.max(0.1, vectorWeight));
    const safeGraph = Math.min(0.9, Math.max(0.1, graphWeight));

    await supabase.from("system_memory").insert({
      key: "mcp_weights",
      value: {
        vectorWeight: safeVector,
        graphWeight: safeGraph,
        agentBias,
      },
      trace_id: traceId ?? null,
      updated_at: new Date().toISOString(),
    });

    return {
      success: true,
      vectorWeight: safeVector,
      graphWeight: safeGraph,
    };
  }

  /**
   * Update agent performance memory
   */
  async updateAgentBias(agentBias: Record<string, number>, traceId?: string) {
    const safeBias: Record<string, number> = {};

    for (const [agent, score] of Object.entries(agentBias)) {
      safeBias[agent] = Math.min(1, Math.max(0, score));
    }

    await supabase.from("system_memory").insert({
      key: "agent_bias",
      value: safeBias,
      trace_id: traceId ?? null,
      updated_at: new Date().toISOString(),
    });

    return safeBias;
  }

  /**
   * Full autonomy cycle (called after learning)
   */
  async runAutonomyCycle(input: {
    learningOutput: {
      vectorWeight: number;
      graphWeight: number;
      agentBias: Record<string, number>;
    };
    governor: any;
    traceId?: string;
  }) {
    const { learningOutput, governor, traceId } = input;

    // 🔐 GOVERNOR CHECK (CRITICAL)
    if (!governor?.allowed) {
      return {
        success: false,
        reason: "Blocked by MCP Governor",
      };
    }

    // 🔷 STEP 1: Update weights
    const weights = await this.updateSystemWeights({
      vectorWeight: learningOutput.vectorWeight,
      graphWeight: learningOutput.graphWeight,
      agentBias: learningOutput.agentBias,
      traceId,
    });

    // 🔷 STEP 2: Update agent bias separately
    const bias = await this.updateAgentBias(
      learningOutput.agentBias,
      traceId
    );

    return {
      success: true,
      weights,
      bias,
      traceId,
    };
  }
}
