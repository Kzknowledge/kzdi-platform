import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

import { MCPDecisionEngine } from "./decisionEngine";
import { MCPGovernor } from "./mcpGovernor";
import { MCPLearningBrain } from "./learningBrain";
import { MCPAutonomyEngine } from "./autonomyEngine";
import { MCPTraceEngine } from "./trace";

import { MCPCompetitionEngine } from "./competitionEngine";
import { EvolutionRegistry } from "./evolutionRegistry";

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

  private competitionEngine = new MCPCompetitionEngine();
  private evolutionRegistry = new EvolutionRegistry();

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
    const vectorResultsRaw = await this.vectorSearch(queryEmbedding);

    const vectorResults = (vectorResultsRaw || []).map((v: any) => ({
      id: v?.id ?? "unknown",
      score: v?.score ?? 0,
    }));

    const nodeIds = vectorResults.map((v) => v.id);

    await trace.logVectorSearch(query, vectorResults.length);

    // ===============================
    // 🕸 5. GRAPH TRAVERSAL
    // ===============================
    const graphEdgesRaw = await this.graphTraversal(nodeIds);

    const graphEdges = (graphEdgesRaw || []).map((e: any) => ({
      from_node_id: e?.from_node_id ?? "",
      to_node_id: e?.to_node_id ?? "",
      label: e?.label ?? "unknown",
      strength: e?.strength ?? 0.5,
    }));

    await trace.logGraphTraversal(nodeIds);

    // ===============================
    // ⚔️ 6. MULTI-AGENT COMPETITION
    // ===============================
    const competition = this.competitionEngine.run({
      query,
      vectorResults,
      graphNodes: nodeIds,
      agents: AGENT_REGISTRY,
    });

    const decision = competition?.winner?.agent;

    if (!decision) {
      await trace.log({ type: "competition_failed_no_winner" });
      throw new Error("No agent selected by competition engine");
    }

    await trace.log({
      type: "agent_competition_result",
      winner: decision.id,
      score: competition.winner.score,
      ranking: competition.ranking.map((r) => ({
        id: r?.agent?.id ?? "unknown",
        score: r?.score ?? 0,
      })),
    });

    // ===============================
    // 🔒 7. GOVERNANCE APPROVAL CHECK (STRICT)
    // ===============================
    const approval = await this.evolutionRegistry.getStatus(decision.id);

    const isBlocked =
      approval &&
      approval.status !== "approved";

    if (isBlocked) {
      await trace.log({
        type: "agent_blocked_pending_approval",
        agent: decision.id,
        status: approval.status,
      });

      return {
        query,
        traceId: trace.getTraceId(),
        status: "blocked_pending_approval",
        proposed_agent: decision.id,
      };
    }

    // ===============================
    // 🤖 8. AGENT EXECUTION
    // ===============================
    await trace.log({
      type: "agent_execution_start",
      agent: decision.id,
      competition_mode: true,
    });

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

    await trace.log({
      type: "agent_execution_success",
      agent: decision.id,
    });

    // ===============================
    // 📊 9. LEARNING PHASE
    // ===============================
    const signals = await this.learningBrain.fetchRecentSignals(50);

    await trace.log({
      type: "learning_snapshot",
      count: signals.length,
    });

    // ===============================
    // 🔁 10. AUTONOMY ANALYSIS (SAFE)
    // ===============================
    const autonomySignal = await this.autonomyEngine.analyze(signals);

    await trace.log({
      type: "autonomy_signal_generated",
      signal: autonomySignal?.type ?? null,
    });

    // ===============================
    // 🧠 11. GOVERNED SYSTEM MEMORY UPDATE
    // ===============================
    if (autonomySignal?.type && autonomySignal?.payload) {
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

      competition: competition.ranking ?? [],

      autonomy: autonomySignal ?? null,
    };
  }

  /**
   * 🧠 SYSTEM MEMORY UPDATE (GOVERNED)
   */
  private async applySystemMemoryUpdate(signal: any, trace: MCPTraceEngine) {
    switch (signal.type) {
      case "vector_weight_increase":
        await applySystemUpdate("vector_weights", {
          bias: "increase",
          reason: signal.payload?.reason ?? "auto",
        });
        break;

      case "agent_bias_adjustment":
        await applySystemUpdate("agent_policy", {
          strategy: "rebalance",
          reason: signal.payload?.reason ?? "auto",
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

  /**
   * 🔍 EMBEDDING ENGINE
   */
  private async embedQuery(text: string): Promise<number[]> {
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return res.data?.[0]?.embedding ?? [];
  }

  /**
   * 🔍 VECTOR SEARCH
   */
  private async vectorSearch(queryEmbedding: number[]) {
    const { data, error } = await supabase.rpc("match_nodes", {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 5,
    });

    if (error) throw error;
    return data ?? [];
  }

  /**
   * 🕸 GRAPH TRAVERSAL
   */
  private async graphTraversal(nodeIds: string[]) {
    if (!nodeIds.length) return [];

    const { data, error } = await supabase
      .from("edges")
      .select("from_node_id, to_node_id, label, strength")
      .in("from_node_id", nodeIds);

    if (error) throw error;
    return data ?? [];
  }
        }
