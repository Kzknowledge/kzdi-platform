import { createClient } from "@supabase/supabase-js";
import { MCPLearningBrain } from "./learningBrain";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

/**
 * MCP Autonomy Engine
 * Applies learned insights back into system behavior
 * (closed-loop optimization layer)
 */

type SystemWeights = {
  vectorWeight: number;
  graphWeight: number;
  agentBias: Record<string, number>;
};

export class MCPAutonomyEngine {
  private learningBrain: MCPLearningBrain;

  constructor() {
    this.learningBrain = new MCPLearningBrain();
  }

  /**
   * Pull latest learned system intelligence
   */
  async getLatestSystemState(): Promise<SystemWeights> {
    const learned = await this.learningBrain.computeAdaptiveWeights();

    return {
      vectorWeight: learned.vectorWeight,
      graphWeight: learned.graphWeight,
      agentBias: learned.agentBias
    };
  }

  /**
   * Apply learned weights to system configuration (soft update)
   */
  async applySystemAdjustments() {
    const state = await this.getLatestSystemState();

    // 🔷 store in Supabase for MCP Brain consumption
    const { error } = await supabase
      .from("system_memory")
      .upsert({
        id: "mcp_runtime_weights",
        data: state,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error("Autonomy update failed:", error.message);
      return {
        status: "failed",
        error: error.message
      };
    }

    return {
      status: "success",
      applied: state
    };
  }

  /**
   * Suggest real-time agent priority ordering
   */
  async getOptimizedAgentOrder(agentIds: string[]) {
    const state = await this.getLatestSystemState();

    const ranked = agentIds
      .map(id => ({
        id,
        score: state.agentBias[id] || 0.5
      }))
      .sort((a, b) => b.score - a.score);

    return {
      rankedAgents: ranked,
      weights: state
    };
  }

  /**
   * Full autonomy cycle runner (cron/job trigger)
   */
  async runAutonomyCycle() {
    const result = await this.applySystemAdjustments();

    return {
      timestamp: new Date().toISOString(),
      cycle: "mcp_autonomy_update",
      result
    };
  }
}
