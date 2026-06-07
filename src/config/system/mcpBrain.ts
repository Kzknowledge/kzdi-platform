import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

import { MCPDecisionEngine } from "./decisionEngine";
import { MCPGovernor } from "./mcpGovernor";
import { MCPLearningBrain } from "./learningBrain";
import { MCPAutonomyEngine } from "./autonomyEngine";
import { MCPTraceEngine } from "./trace";
import { executeAgent, AGENT_REGISTRY } from "../../agents/registry";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type VectorResult = { id: string; score: number };

type GraphEdge = {
  from_node_id: string;
  to_node_id: string;
  label: string;
  strength?: number;
};

export class MCPBrain {
  private decisionEngine = new MCPDecisionEngine();
  private governor = new MCPGovernor();
  private learningBrain = new MCPLearningBrain();
  private autonomyEngine = new MCPAutonomyEngine();

  /**
   * 🧠 SINGLE ENTRY POINT — FULL AUTONOMY EXECUTION
   */
  async run(input: { query: string; trace: MCPTraceEngine }) {
    const { query, trace } = input;

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

    // 🔷 STEP 5: DECISION ENGINE
    const decision = this.decisionEngine.selectAgent({
      query,
      vectorResults,
      graphNodes: nodeIds,
      agents: AGENT_REGISTRY,
    });

    await trace.log({
      type: "agent_selected",
      agent: decision.id,
      score: decision.score,
    });

    // 🔷 STEP 6: AGENT EXECUTION
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

    // 🔷 STEP 7: LEARNING SNAPSHOT
    const learning = await this.learningBrain.fetchRecentSignals(50);

    await trace.log({
      type: "learning_snapshot",
      count: learning.length,
    });

    // 🔷 STEP 8: AUTONOMY ANALYSIS (NO WRITE YET)
    const autonomySignal = await this.autonomyEngine.analyze?.(learning);

    await trace.log({
      type: "autonomy_evaluated",
      hasSignal: !!autonomySignal,
    });

    // 🔒 STEP 9: GOVERNOR POST-CHECK
    await this.governor.postCheck({
      query,
      agent: decision.id,
    });

    await trace.finish("success");

    return {
      query,
      agent: decision,
      result,
      vectorResults,
      graphEdges,
      learning_snapshot: learning.length,
      autonomy_signal: autonomySignal || null,
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
   * 🔍 VECTOR SEARCH (pgvector)
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
  private async graphTraversal(nodeIds: string[]): Promise<GraphEdge[]> {
    if (!nodeIds.length) return [];

    const { data, error } = await supabase
      .from("edges")
      .select("from_node_id, to_node_id, label, strength")
      .in("from_node_id", nodeIds);

    if (error) throw error;
    return data || [];
  }
}
