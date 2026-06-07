import express from "express";
import { getSystemStatus } from "./config/system";
import { MCPTraceEngine } from "./config/system/trace";
import { executeAgent } from "./agents/registry";

const app = express();

/**
 * Middleware
 */
app.use(express.json());

/**
 * Health endpoint (system observability)
 */
app.get("/api/health", async (_req, res) => {
  const status = await getSystemStatus();
  res.json(status);
});

/**
 * MCP QUERY ENTRY POINT (CORE SYSTEM ROUTE)
 * FULL TRACE + AGENT INTEGRATION PIPELINE
 */
app.post("/api/query", async (req, res) => {
  const trace = new MCPTraceEngine();

  try {
    const { query } = req.body;

    if (!query) {
      await trace.log({
        type: "invalid_request",
        error: "Query is required"
      });

      return res.status(400).json({
        error: "Query is required",
        traceId: trace.getTraceId()
      });
    }

    // 🔷 STEP 1: Request received
    await trace.log({
      type: "request_received",
      query
    });

    // 🔷 STEP 2: Agent execution (core routing agent)
    const agentResult = await executeAgent(
      "KZDI-CORE-AGENT-01",
      { query },
      { trace } // 👈 FULL TRACE INTEGRATION
    );

    await trace.log({
      type: "agent_execution_completed",
      agent: agentResult.agent
    });

    // 🔷 STEP 3: Response construction
    const response = {
      query,
      answer: "MCP execution completed via agent pipeline",
      agent: agentResult,
      traceId: trace.getTraceId(),
      timestamp: new Date().toISOString()
    };

    // 🔷 STEP 4: Finish trace
    await trace.finish("success");

    return res.json(response);

  } catch (err: any) {

    // 🔴 TRACE FAILURE
    await trace.log({
      type: "request_failed",
      error: err.message
    });

    await trace.finish("failed");

    return res.status(500).json({
      error: err.message || "Internal server error",
      traceId: trace.getTraceId()
    });
  }
});

/**
 * Root endpoint (basic system identity check)
 */
app.get("/", (_req, res) => {
  res.json({
    service: "KZDI MCP Platform",
    status: "running",
    version: "1.0.0"
  });
});

/**
 * Server startup
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on port ${PORT}`);
});
