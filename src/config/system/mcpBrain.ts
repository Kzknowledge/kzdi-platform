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
   * 🧠 SINGLE ENTRY POINT (FULL AUTONOMY LOOP)
   */
  async run({ query, trace }: { query: string; trace: MCPTraceEngine }) {
    // 🔒 STEP 1: GOVERNOR PRE-CHECK
    await this.governor.preCheck({ query });
    await trace.log({ type: "governor_precheck_passed" });

    // 🔷 STEP 2: EMBEDDING
    const queryEmbedding = await this.embedQuery(query);

    // 🔷 STEP 3: VECTOR SEARCH
    const vectorResults = await this.vectorSearch(queryEmbedding);
    await trace.logVectorSearch(query, vectorResults.length);

    const nodeIds = vectorResults.map((v) => v.id);

    // 🔷 STEP 4: GRAPH EXPANSION
    const graphEdges = await this.graphTraversal(nodeIds);
    await trace.logGraphTraversal(nodeIds);

    // 🔷 STEP 5: LOAD SYSTEM MEMORY (IMPORTANT)
    const systemBias = await getSystemMemory("agent_policy");

    await trace.log({
      type: "system_memory_loaded",
      bias: systemBias,
    });

    // 🔷 STEP 6: DECISION ENGINE (MEMORY-AWARE)
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

    // 🔷 STEP 7: AGENT EXECUTION
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

    // 🔷 STEP 8: LEARNING ANALYSIS
    const signals = await this.learningBrain.fetchRecentSignals(50);

    await trace.log({
      type: "learning_snapshot",
      count: signals.length,
    });

    // 🔷 STEP 9: AUTONOMY ANALYSIS
    const autonomySignal = await this.autonomyEngine.analyze(signals);

    await trace.log({
      type: "autonomy_signal",
      signal: autonomySignal?.type || null,
    });

    // 🔷 STEP 10: GOVERNOR VALIDATION
    if (autonomySignal) {
      await this.governor.validateSystemChange({
        query,
        signal: autonomySignal,
      });

      // 🔥 APPLY SYSTEM UPDATE (CONTROLLED)
      await applySystemUpdate(
        "system_policy",
        autonomySignal,
        {
          reason: autonomySignal.payload?.reason,
          source: "autonomy_engine",
        }
      );

      await trace.log({
        type: "system_memory_updated",
        update: autonomySignal.type,
      });
    }

    await this.governor.postCheck({
      query,
      agent: decision.id,
    });

    await trace.finish("success");

    return {
      query,
      traceId: trace.getTraceId(),

      agent: decision,
      result,

      reasoning: {
        vector_hits: vectorResults,
        graph_edges: graphEdges,
        selected_nodes: nodeIds,
        memory_bias: systemBias,
      },

      autonomy: autonomySignal || null,
    };
  }

  /**
   * 🔍 EMBEDDING ENGINE
   */
  private async embedQuery(text: string): Promise<number[]> {
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return res.data[0].embedding;
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
    return data || [];
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
    return data || [];
  }
}
