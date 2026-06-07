import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

import { MCPDecisionEngine } from "./decisionEngine";
import { MCPGovernor } from "./mcpGovernor";
import { MCPLearningBrain } from "./learningBrain";
import { MCPAutonomyEngine } from "./autonomyEngine";
import { MCPTraceEngine } from "./trace";

import {
  getSystemMemory,
  applySystemUpdate,
} from "./system-memory";

import { executeAgent, AGENT_REGISTRY } from "../../agents/registry";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export class MCPBrain {
  private decisionEngine = new MCPDecisionEngine();
  private governor = new MCPGovernor();
  private learningBrain = new MCPLearningBrain();
  private autonomyEngine = new MCPAutonomyEngine();

  /**
   * 🧠 MAIN MCP EXECUTION PIPELINE
   */
  async run({
    query,
    trace,
  }: {
    query: string;
    trace: MCPTraceEngine;
  }) {
    // ===============================
    // 🔒 1. GOVERNOR PRE-CHECK
    // ===============================
    await this.governor.preCheck({ query });
    await trace.log({ type: "governor_precheck_passed" });

    // ===============================
    // 🧠 2. SYSTEM MEMORY LOAD
    // ===============================
    const systemBias = await getSystemMemory("agent_policy");
    const vectorBias = await getSystemMemory("vector_weights");

    await trace.log({
      type: "system_memory_loaded",
      systemBias,
      vectorBias,
    });

    // ===============================
    // 🔷 3. EMBEDDING
    // ===============================
    const queryEmbedding = await this.embedQuery(query);

    // ===============================
    // 🔷 4. VECTOR SEARCH
    // ===============================
    const vectorResults = await this.vectorSearch(queryEmbedding);
    const nodeIds = vectorResults.map((v) => v.id);

    await trace.logVectorSearch(query, vectorResults.length);

    // ===============================
    // 🕸 5. GRAPH EXPANSION
    // ===============================
    const graphEdges = await this.graphTraversal(nodeIds);

    await trace.logGraphTraversal(nodeIds);

    // ===============================
    // 🧭 6. DECISION ENGINE (MEMORY-AWARE)
    // ===============================
    const decision = await this.decisionEngine.selectAgent({
      query,
      vectorResults,
      graphNodes: nodeIds,
      agents: AGENT_REGISTRY,
    });

    await trace.log({
      type: "agent_selected",
      agent: decision.id,
      score: decision.score,
      memoryInfluenced: decision.memoryInfluenced,
    });

    // ===============================
    // 🤖 7. AGENT EXECUTION
    // ===============================
    await trace.logAgentExecution(decision.id, "start");

    const result = await executeAgent(
      decision.id,
      {
        query,
        vector_results: vectorResults,
        graph_edges: graphEdges,
        selected_nodes: nodeIds,
      },
      { trace }
    );

    await trace.logAgentExecution(decision.id, "success");

    // ===============================
    // 🧠 8. RL FEEDBACK LOOP (AUDITED + SAFE)
    // ===============================

    const startTime = Date.now();

    let success = true;
    let confidence = 0.5;

    try {
      success =
        typeof result === "object" &&
        result !== null &&
        (result.success !== false);

      confidence =
        typeof decision?.score === "number"
          ? decision.score
          : 0.5;
    } catch (err) {
      await trace.log({
        type: "rl_signal_parse_error",
        error: (err as Error).message,
      });
    }

    const durationMs = Date.now() - startTime;

    let rlSignal: any = null;

    try {
      rlSignal = await this.computeReinforcementSignal({
        success,
        durationMs,
        confidence,
        agentId: decision.id,
      });
    } catch (err) {
      await trace.log({
        type: "rl_signal_compute_failed",
        error: (err as Error).message,
      });
    }

    if (rlSignal) {
      await trace.log({
        type: "reinforcement_signal",
        signal: rlSignal,
      });
    }

    try {
      if (rlSignal) {
        await this.applyReinforcementUpdate(rlSignal);
      }
    } catch (err) {
      await trace.log({
        type: "rl_memory_update_failed",
        error: (err as Error).message,
      });
    }

    // ===============================
    // 📊 9. LEARNING PHASE
    // ===============================
    const signals = await this.learningBrain.fetchRecentSignals(50);

    await trace.log({
      type: "learning_snapshot",
      count: signals.length,
    });

    // ===============================
    // 🔁 10. AUTONOMY ANALYSIS
    // ===============================
    const autonomySignal = await this.autonomyEngine.analyze(signals);

    await trace.log({
      type: "autonomy_signal_generated",
      signal: autonomySignal?.type || null,
    });

    // ===============================
    // 🧠 11. GOVERNED MEMORY UPDATE
    // ===============================
    if (autonomySignal) {
      await this.governor.validateSystemChange({
        query,
        signal: autonomySignal,
      });

      await this.applySystemMemoryUpdate(autonomySignal, trace);
    }

    // ===============================
    // 🔒 12. GOVERNOR POST-CHECK
    // ===============================
    await this.governor.postCheck({
      query,
      agent: decision.id,
    });

    await trace.finish("success");

    // ===============================
    // 📦 FINAL OUTPUT
    // ===============================
    return {
      query,
      traceId: trace.getTraceId(),

      agent: decision,
      result,

      system_memory: {
        bias: systemBias,
        vector: vectorBias,
      },

      reasoning: {
        vector_hits: vectorResults,
        graph_edges: graphEdges,
        selected_nodes: nodeIds,
      },

      autonomy: autonomySignal || null,
      reinforcement: rlSignal || null,
    };
  }

  // ===============================
  // 🧠 RL ENGINE (SAFE)
  // ===============================
  private async computeReinforcementSignal(params: {
    success: boolean;
    durationMs?: number;
    confidence?: number;
    agentId: string;
  }) {
    const { success, durationMs = 0, confidence = 0.5, agentId } = params;

    let reward = 0;

    reward += success ? 1 : -1;
    reward += confidence * 0.5;

    if (durationMs > 3000) {
      reward -= 0.2;
    }

    reward = Math.max(-1, Math.min(1, reward));

    return {
      agentId,
      reward,
      success,
      durationMs,
      confidence,
      timestamp: new Date().toISOString(),
    };
  }

  private async applyReinforcementUpdate(signal: any) {
    const policy = await getSystemMemory("agent_policy");
    const agentId = signal.agentId;

    const current = policy?.[agentId] ?? 0.5;

    const updated = current * 0.8 + signal.reward * 0.2;

    await applySystemUpdate("agent_policy", {
      strategy: "rl_update",
      agentId,
      reward: signal.reward,
      updatedScore: updated,
    });
  }

  // ===============================
  // 🧠 SYSTEM MEMORY UPDATE HANDLER
  // ===============================
  private async applySystemMemoryUpdate(
    signal: any,
    trace: MCPTraceEngine
  ) {
    switch (signal.type) {
      case "vector_weight_increase":
        await applySystemUpdate("vector_weights", {
          bias: "increase",
          reason: signal.payload.reason,
        });
        break;

      case "agent_bias_adjustment":
        await applySystemUpdate("agent_policy", {
          strategy: "rebalance",
          reason: signal.payload.reason,
        });
        break;

      default:
        await trace.log({
          type: "autonomy_no_action_taken",
        });
    }

    await trace.log({
      type: "system_memory_updated",
      update: signal.type,
    });
  }

  // ===============================
  // 🔍 EMBEDDING ENGINE
  // ===============================
  private async embedQuery(text: string): Promise<number[]> {
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return res.data[0].embedding;
  }

  // ===============================
  // 🔍 VECTOR SEARCH
  // ===============================
  private async vectorSearch(queryEmbedding: number[]) {
    const { data, error } = await supabase.rpc("match_nodes", {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 5,
    });

    if (error) throw error;
    return data || [];
  }

  // ===============================
  // 🕸 GRAPH TRAVERSAL
  // ===============================
  private async graphTraversal(nodeIds: string[]) {
    if (!nodeIds.length) return [];

    const { data, error } = await supabase
      .from("edges")
      .select("from_node_id, to_node_id, label, strength")
      .in("from_node_id", nodeIds);

    if (error) throw error;
    return data || [];
  }
    }
