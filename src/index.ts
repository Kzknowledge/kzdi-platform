import express from "express";
import { getSystemStatus } from "./config/system";
import { MCPTraceEngine } from "./config/system/trace";
import { executeAgent, AGENT_REGISTRY } from "./agents/registry";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { MCPDecisionEngine } from "./config/system/decisionEngine";

const app = express();
app.use(express.json());

/**
 * INFRA INIT
 */
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const decisionEngine = new MCPDecisionEngine();

/**
 * EMBEDDING (QUERY TIME)
 */
async function embedQuery(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return res.data[0].embedding;
}

/**
 * VECTOR SEARCH (pgvector MCP memory)
 */
async function vectorSearch(queryEmbedding: number[]) {
  const { data, error } = await supabase.rpc("match_nodes", {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: 5,
  });

  if (error) throw error;

  return data || [];
}

/**
 * GRAPH EXPANSION (edges layer)
 */
async function graphTraversal(nodeIds: string[]) {
  if (!nodeIds.length) return [];

  const { data, error } = await supabase
    .from("edges")
    .select("from_node_id, to_node_id, label, strength")
    .in("from_node_id", nodeIds);

  if (error) throw error;

  return data || [];
}

/**
 * HEALTH ENDPOINT
 */
app.get("/api/health", async (_req, res) => {
  const status = await getSystemStatus();
  res.json(status);
});

/**
 * MCP QUERY ENTRY POINT (FULL BRAIN PIPELINE)
 */
app.post("/api/query", async (req, res) => {
  const trace = new MCPTraceEngine();

  try {
    const { query } = req.body;

    if (!query) {
      await trace.log({ type: "request_failed", reason: "missing_query" });

      return res.status(400).json({
        error: "Query is required",
        traceId: trace.getTraceId(),
      });
    }

    // 🔷 STEP 1: TRACE INPUT
    await trace.log({ type: "query_received", query });

    // 🔷 STEP 2: EMBEDDING
    const queryEmbedding = await embedQuery(query);

    // 🔷 STEP 3: VECTOR SEARCH
    const vectorResults = await vectorSearch(queryEmbedding);

    await trace.logVectorSearch(query, vectorResults.length);

    const nodeIds = vectorResults.map((v: any) => v.id);

    // 🔷 STEP 4: GRAPH TRAVERSAL
    const graphEdges = await graphTraversal(nodeIds);

    await trace.logGraphTraversal(nodeIds);

    // 🔷 STEP 5: LOAD AGENTS
    const agents = AGENT_REGISTRY;

    // 🔷 STEP 6: DECISION ENGINE (🔥 NEW BRAIN LOGIC)
    const decision = decisionEngine.selectAgent({
      query,
      vectorResults,
      graphNodes: nodeIds,
      agents,
    });

    await trace.log({
      type: "agent_selected",
      agent: decision.id,
      alias: decision.alias,
      mcp_layer: decision.mcp_layer,
    });

    // 🔷 STEP 7: AGENT EXECUTION
    await trace.logAgentExecution(decision.id, "start");

    const agentResult = await executeAgent(
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

    // 🔷 STEP 8: RESPONSE BUILD
    const response = {
      query,
      traceId: trace.getTraceId(),

      result: {
        answer: "MCP execution completed with full vector + graph + decision engine binding",
        agent: agentResult,
      },

      decision: {
        selected_agent: decision.id,
        alias: decision.alias,
        mcp_layer: decision.mcp_layer,
      },

      reasoning: {
        vector_hits: vectorResults,
        graph_edges: graphEdges,
        selected_nodes: nodeIds,
      },

      timestamp: new Date().toISOString(),
    };

    // 🔷 STEP 9: TRACE COMPLETE
    await trace.finish("success");

    return res.json(response);
  } catch (err: any) {
    await trace.log({ type: "system_error", error: err.message });
    await trace.finish("failed");

    return res.status(500).json({
      error: err.message || "Internal server error",
      traceId: trace.getTraceId(),
    });
  }
});

/**
 * ROOT
 */
app.get("/", (_req, res) => {
  res.json({
    service: "KZDI MCP Platform",
    status: "running",
    architecture: "vector + graph + decision engine + agent + trace",
  });
});

/**
 * SERVER START
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on port ${PORT}`);
});
