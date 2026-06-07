import express from "express";
import { getSystemStatus } from "./config/system";
import { MCPTraceEngine } from "./config/system/trace";
import { MCPBrain } from "./config/system/mcpBrain";

const app = express();
app.use(express.json());

// 🧠 SINGLE BRAIN INSTANCE
const brain = new MCPBrain();

/**
 * HEALTH ENDPOINT (unchanged)
 */
app.get("/api/health", async (_req, res) => {
  const status = await getSystemStatus();
  res.json(status);
});

/**
 * MCP QUERY ENTRY POINT (NOW PURE GATEWAY)
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

    // 🔷 TRACE INPUT ONLY (NO LOGIC)
    await trace.log({ type: "query_received", query });

    /**
     * 🧠 FULL MCP EXECUTION DELEGATED TO BRAIN
     */
    const result = await brain.run({
      query,
      vectorResults: [], // MCPBrain will eventually own retrieval abstraction
      graphEdges: [],
      trace,
    });

    return res.json({
      traceId: trace.getTraceId(),
      result,
    });
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
    architecture: "MCPBrain-controlled runtime",
  });
});

/**
 * SERVER START
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on port ${PORT}`);
});
