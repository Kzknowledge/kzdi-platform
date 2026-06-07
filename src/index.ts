import express from "express";
import { getSystemStatus } from "./config/system";
import { MCPTraceEngine } from "./config/system/trace";
import { executeAgent } from "./agents/registry";

const app = express();

app.use(express.json());

/**
 * HEALTH ENDPOINT
 */
app.get("/api/health", async (_req, res) => {
  const status = await getSystemStatus();
  res.json(status);
});

/**
 * MCP QUERY ENTRY POINT (FULL TRACE + GRAPH + VECTOR + AGENT BINDING)
 */
app.post("/api/query", async (req, res) => {
  const trace = new MCPTraceEngine();

  try {
    const { query } = req.body;

    if (!query) {
      await trace.logRequestFailed("Query is required");

      return res.status(400).json({
        error: "Query is required",
        traceId: trace.getTraceId()
      });
    }

    // 🔷 STEP 1: REQUEST RECEIVED
    await trace.logRequestReceived(query);

    // 🔷 STEP 2: VECTOR SEARCH (SIMULATED LAYER - replace with pgvector later)
    const vectorResults = [
      { id: "node_hausa_nlp", score: 0.94 },
      { id: "node_mcp_core", score: 0.89 },
      { id: "node_ai_agents", score: 0.83 }
    ];

    await trace.logVectorSearch(query, vectorResults);

    const nodeIds = vectorResults.map(v => v.id);

    // 🔷 STEP 3: GRAPH TRAVERSAL (SIMULATED STRUCTURE)
    const graphEdges = [
      { from: "node_hausa_nlp", to: "node_mcp_core", label: "depends_on" },
      { from: "node_mcp_core", to: "node_ai_agents", label: "orchestrates" }
    ];

    await trace.logGraphTraversal(nodeIds, graphEdges);

    // 🔷 STEP 4: AGENT EXECUTION (TRACE-AWARE)
    await trace.logAgentExecution("KZDI-CORE-AGENT-01", "start");

    const agentResult = await executeAgent(
      "KZDI-CORE-AGENT-01",
      {
        query,
        context_nodes: nodeIds,
        graph_edges: graphEdges,
        vector_results: vectorResults
      },
      { trace }
    );

    await trace.logAgentExecution("KZDI-CORE-AGENT-01", "success");

    // 🔷 STEP 5: RESPONSE BUILD (EXPLAINABLE OUTPUT)
    const response = {
      query,
      answer: "MCP fully executed with graph + vector + agent binding",
      traceId: trace.getTraceId(),

      // 🧠 AI execution transparency
      reasoning: {
        selected_nodes: nodeIds,
        vector_hits: vectorResults,
        graph_path: graphEdges,
        agent_used: agentResult.alias
      },

      agent: agentResult,
      timestamp: new Date().toISOString()
    };

    // 🔷 STEP 6: FINISH TRACE
    await trace.finish("success");

    return res.json(response);

  } catch (err: any) {
    await trace.logRequestFailed(err.message);
    await trace.finish("failed");

    return res.status(500).json({
      error: err.message || "Internal server error",
      traceId: trace.getTraceId()
    });
  }
});

/**
 * ROOT ENDPOINT
 */
app.get("/", (_req, res) => {
  res.json({
    service: "KZDI MCP Platform",
    status: "running",
    version: "1.0.0"
  });
});

/**
 * SERVER START
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on port ${PORT}`);
});
