import express from "express";
import { getSystemStatus } from "./config/system";

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
 * This is where agents + graph + vector + trace engine will connect
 */
app.post("/api/query", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        error: "Query is required"
      });
    }

    // Placeholder MCP response layer (you will connect trace engine here next step)
    const response = {
      query,
      answer: "MCP system running (placeholder response)",
      status: "ok",
      timestamp: new Date().toISOString()
    };

    return res.json(response);

  } catch (err: any) {
    return res.status(500).json({
      error: err.message || "Internal server error"
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
