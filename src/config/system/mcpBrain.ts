import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

import { MCPGovernor } from "./mcpGovernor";
import { MCPLearningBrain } from "./learningBrain";
import { MCPAutonomyEngine } from "./autonomyEngine";
import { MCPCompetitionEngine } from "./competitionEngine";
import { EvolutionRegistry } from "./evolutionRegistry";

import { executeAgent, AGENT_REGISTRY } from "../../agents/registry";
import { MCPTraceEngine } from "./trace";
import { getSystemMemory, applySystemUpdate } from "./system-memory";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export class MCPBrain {
  private governor = new MCPGovernor();
  private learningBrain = new MCPLearningBrain();
  private autonomyEngine = new MCPAutonomyEngine();
  private competitionEngine = new MCPCompetitionEngine();
  private evolutionRegistry = new EvolutionRegistry();

  /**
   * 🧠 EVENT EMITTER (CRITICAL LAYER)
   */
  private async emitEvent(event: {
    type: string;
    traceId: string;
    agentId?: string;
    stage?: string;
    data?: any;
  }) {
    await supabase.from("telemetry_events").insert({
      event_type: event.type,
      event_data: {
        ...event.data,
        agent_id: event.agentId,
        stage: event.stage,
        trace_id: event.traceId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * 🧠 MAIN PIPELINE
   */
  async run({ query, trace }: { query: string; trace: MCPTraceEngine }) {
    await this.governor.preCheck({ query });

    const traceId = trace.getTraceId();

    await this.emitEvent({
      type: "query_received",
      traceId,
      data: { query },
    });

    // ===============================
    // EMBEDDING
    // ===============================
    const embedding = await this.embedQuery(query);

    await this.emitEvent({
      type: "embedding_generated",
      traceId,
    });

    // ===============================
    // VECTOR SEARCH
    // ===============================
    const vectorResults = await this.vectorSearch(embedding);
    const nodeIds = vectorResults.map((v) => v.id);

    await this.emitEvent({
      type: "vector_search",
      traceId,
      data: { results: vectorResults },
    });

    // ===============================
    // GRAPH EXPANSION
    // ===============================
    const graphEdges = await this.graphTraversal(nodeIds);

    await this.emitEvent({
      type: "graph_expansion",
      traceId,
      data: { edges: graphEdges },
    });

    // ===============================
    // COMPETITION ENGINE
    // ===============================
    const competition = this.competitionEngine.run({
      query,
      vectorResults,
      graphNodes: nodeIds,
      agents: AGENT_REGISTRY,
    });

    const decision = competition.winner.agent;

    await this.emitEvent({
      type: "agent_selected",
      traceId,
      agentId: decision.id,
      stage: "decision",
      data: {
        score: competition.winner.score,
        ranking: competition.ranking,
      },
    });

    // ===============================
    // GOVERNANCE CHECK
    // ===============================
    const approval = await this.evolutionRegistry.getStatus(decision.id);

    if (approval?.status !== "approved") {
      await this.emitEvent({
        type: "agent_blocked",
        traceId,
        agentId: decision.id,
      });

      return {
        status: "blocked",
        proposed_agent: decision.id,
        traceId,
      };
    }

    // ===============================
    // EXECUTION
    // ===============================
    await this.emitEvent({
      type: "agent_execution_start",
      traceId,
      agentId: decision.id,
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

    await this.emitEvent({
      type: "agent_execution_success",
      traceId,
      agentId: decision.id,
      data: { result },
    });

    // ===============================
    // LEARNING
    // ===============================
    const signals = await this.learningBrain.fetchRecentSignals(50);

    await this.emitEvent({
      type: "learning_snapshot",
      traceId,
      data: { count: signals.length },
    });

    // ===============================
    // AUTONOMY
    // ===============================
    const autonomySignal = await this.autonomyEngine.analyze(signals);

    if (autonomySignal) {
      await this.governor.validateSystemChange({
        query,
        signal: autonomySignal,
      });

      await this.applySystemMemoryUpdate(autonomySignal, trace);
    }

    await trace.finish("success");

    return {
      query,
      traceId,
      agent: decision,
      result,
      autonomy: autonomySignal || null,
    };
  }

  /**
   * 🧠 SYSTEM MEMORY UPDATE
   */
  private async applySystemMemoryUpdate(signal: any, trace: MCPTraceEngine) {
    switch (signal.type) {
      case "vector_weight_increase":
        await applySystemUpdate("vector_weights", signal.payload);
        break;

      case "agent_bias_adjustment":
        await applySystemUpdate("agent_policy", signal.payload);
        break;

      default:
        await this.emitEvent({
          type: "autonomy_no_action",
          traceId: trace.getTraceId(),
        });
    }
  }

  // ===============================
  // INFRA METHODS
  // ===============================

  private async embedQuery(text: string): Promise<number[]> {
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return res.data[0].embedding;
  }

  private async vectorSearch(embedding: number[]) {
    const { data } = await supabase.rpc("match_nodes", {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5,
    });
    return data || [];
  }

  private async graphTraversal(nodeIds: string[]) {
    const { data } = await supabase
      .from("edges")
      .select("*")
      .in("from_node_id", nodeIds);

    return data || [];
  }
}
