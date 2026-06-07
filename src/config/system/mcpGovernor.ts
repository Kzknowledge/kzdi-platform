import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

/**
 * MCP Governor
 * Safety + stability layer for autonomous learning system
 */

type SystemWeights = {
  vectorWeight: number;
  graphWeight: number;
  agentBias: Record<string, number>;
};

export class MCPGovernor {
  /**
   * Safety constraints
   */
  private readonly LIMITS = {
    minWeight: 0.1,
    maxWeight: 0.9,
    maxDriftPerCycle: 0.15
  };

  /**
   * Validate learned system state before applying
   */
  validate(weights: SystemWeights) {
    const issues: string[] = [];

    // 🔷 VECTOR SAFETY
    if (
      weights.vectorWeight < this.LIMITS.minWeight ||
      weights.vectorWeight > this.LIMITS.maxWeight
    ) {
      issues.push("vectorWeight out of bounds");
    }

    // 🔷 GRAPH SAFETY
    if (
      weights.graphWeight < this.LIMITS.minWeight ||
      weights.graphWeight > this.LIMITS.maxWeight
    ) {
      issues.push("graphWeight out of bounds");
    }

    // 🔷 AGENT BIAS SAFETY
    Object.entries(weights.agentBias).forEach(([agent, value]) => {
      if (value < this.LIMITS.minWeight || value > this.LIMITS.maxWeight) {
        issues.push(`agentBias out of bounds: ${agent}`);
      }
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Detect abnormal learning drift
   */
  detectDrift(previous: SystemWeights, next: SystemWeights) {
    const vectorDrift = Math.abs(previous.vectorWeight - next.vectorWeight);
    const graphDrift = Math.abs(previous.graphWeight - next.graphWeight);

    const maxDrift = Math.max(vectorDrift, graphDrift);

    return {
      driftDetected: maxDrift > this.LIMITS.maxDriftPerCycle,
      vectorDrift,
      graphDrift
    };
  }

  /**
   * Rollback system state if unsafe update detected
   */
  async rollback() {
    const { data } = await supabase
      .from("system_memory")
      .select("*")
      .eq("id", "mcp_runtime_weights")
      .single();

    if (!data) {
      return {
        status: "failed",
        reason: "no previous state found"
      };
    }

    const previousState = data.data;

    await supabase.from("system_memory").upsert({
      id: "mcp_runtime_weights",
      data: previousState,
      updated_at: new Date().toISOString()
    });

    return {
      status: "rolled_back",
      restored: previousState
    };
  }

  /**
   * Final gate before autonomy engine applies updates
   */
  async approveUpdate(nextState: SystemWeights) {
    const current = await supabase
      .from("system_memory")
      .select("*")
      .eq("id", "mcp_runtime_weights")
      .single();

    const currentState = current.data?.data;

    // 🔷 VALIDATION STEP
    const validation = this.validate(nextState);
    if (!validation.valid) {
      return {
        approved: false,
        reason: "validation_failed",
        issues: validation.issues
      };
    }

    // 🔷 DRIFT CHECK
    if (currentState) {
      const drift = this.detectDrift(currentState, nextState);

      if (drift.driftDetected) {
        return {
          approved: false,
          reason: "drift_detected",
          drift
        };
      }
    }

    return {
      approved: true,
      reason: "safe_to_apply"
    };
  }
}
