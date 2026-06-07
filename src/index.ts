import express from "express";
import { getSystemStatus } from "./config/system";
import { MCPTraceEngine } from "./config/system/trace";
import { executeAgent } from "./agents/registry";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

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
 * VECTOR SEARCH (REAL pgvector)
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
 * GRAPH EXPANSION (REAL edges table)
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

    // 🔷 STEP 2: EMBED QUERY
    const queryEmbedding = await embedQuery(query);

    // 🔷 STEP 3: VECTOR SEARCH (REAL MCP MEMORY)
    const vectorResults = await vectorSearch(queryEmbedding);

    await trace.logVectorSearch(query, vectorResults.length);

    const nodeIds = vectorResults.map((v: any) => v.id);

    // 🔷 STEP 4: GRAPH EXPANSION (REAL RELATIONSHIPS)
    const graphEdges = await graphTraversal(nodeIds);

    await trace.logGraphTraversal(nodeIds);

    // 🔷 STEP 5: AGENT SELECTION (LIGHTWEIGHT RULE LAYER FOR NOW)
    const selectedAgentId = "KZDI-CORE-AGENT-01";

    await trace.logAgentExecution(selectedAgentId, "start");

    // 🔷 STEP 6: AGENT EXECUTION
    const agentResult = await executeAgent(
      selectedAgentId,
      {
        query,
        vector_results: vectorResults,
        graph_edges: graphEdges,
      },
      { trace }
    );

    await trace.logAgentExecution(selectedAgentId, "success");

    // 🔷 STEP 7: RESPONSE BUILD
    const response = {
      query,
      traceId: trace.getTraceId(),

      result: {
        answer: "MCP execution completed with vector + graph + agent binding",
        agent: agentResult,
      },

      reasoning: {
        vector_hits: vectorResults,
        graph_edges: graphEdges,
        selected_nodes: nodeIds,
      },

      timestamp: new Date().toISOString(),
    };

    // 🔷 STEP 8: FINISH TRACE
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
    architecture: "vector + graph + agent + trace",
  });
});

/**
 * START SERVER
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on port ${PORT}`);
});
