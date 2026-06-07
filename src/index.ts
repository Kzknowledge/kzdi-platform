import express from "express";
import { getSystemStatus } from "./config/system";
import { MCPTraceEngine } from "./config/system/trace";
import { executeAgent, AGENT_REGISTRY } from "./agents/registry";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { MCPDecisionEngine } from "./config/system/decisionEngine";
import { MCPGovernor } from "./config/system/mcpGovernor";
import { MCPLearningBrain } from "./config/system/learningBrain";
import { MCPAutonomyEngine } from "./config/system/autonomyEngine";

const app = express();
app.use(express.json());

/**
 * =========================
 * INFRA INITIALIZATION
 * =========================
 */
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const decisionEngine = new MCPDecisionEngine();
const mcpGovernor = new MCPGovernor();
const learningBrain = new MCPLearningBrain();
const autonomyEngine = new MCPAutonomyEngine();

/**
 * =========================
 * EMBEDDING ENGINE
 * =========================
 */
async function embedQuery(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return res.data[0].embedding;
}

/**
 * =========================
 * VECTOR SEARCH (PGVECTOR)
 * =========================
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
 * =========================
 * GRAPH TRAVERSAL
 * =========================
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
 * =========================
 * HEALTH ENDPOINT
 * =========================
 */
app.get("/api/health", async (_req, res) => {
  const status = await getSystemStatus();
  res.json(status);
});

/**
 * =========================
 * MCP QUERY ENTRY POINT
 * (FULL GOVERNED AUTONOMOUS BRAIN)
 * =========================
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

    // =====================================================
    // 🔐 STEP 1: GOVERNOR PRE-CHECK
    // =====================================================
    const preCheck = mcpGovernor.validate({ query });

    if (!preCheck.allowed) {
      await trace.log({
        type: "governor_block_pre",
        reason: preCheck.reason,
      });

      await trace.finish("blocked");

      return res.status(403).json({
        error: "Blocked by MCP Governor",
        reason: preCheck.reason,
        traceId: trace.getTraceId(),
      });
    }

    // =====================================================
    // 🧠 STEP 2: TRACE INPUT
    // =====================================================
    await trace.log({ type: "query_received", query });

    // =====================================================
    // 🧮 STEP 3: VECTOR SEARCH
    // =====================================================
    const embedding = await embedQuery(query);
    const vectorResults = await vectorSearch(embedding);

    await trace.logVectorSearch(query, vectorResults.length);

    const nodeIds = vectorResults.map((v: any) => v.id);

    // =====================================================
    // 🌐 STEP 4: GRAPH EXPANSION
    // =====================================================
    const graphEdges = await graphTraversal(nodeIds);

    await trace.logGraphTraversal(nodeIds);

    // =====================================================
    // 🧠 STEP 5: DECISION ENGINE
    // =====================================================
    const decision = decisionEngine.selectAgent({
      query,
      vectorResults,
      graphNodes: nodeIds,
      agents: AGENT_REGISTRY,
    });

    await trace.log({
      type: "agent_selected",
      agent: decision.id,
      alias: decision.alias,
      mcp_layer: decision.mcp_layer,
    });

    // =====================================================
    // 🔐 STEP 6: GOVERNOR POST-CHECK
    // =====================================================
    const postCheck = mcpGovernor.validate({
      query,
      vectorStrength:
        vectorResults.reduce((s, v) => s + v.score, 0) /
        Math.max(vectorResults.length, 1),
      graphStrength: graphEdges.length,
      agentId: decision.id,
    });

    if (!postCheck.allowed) {
      await trace.log({
        type: "governor_block_post",
        reason: postCheck.reason,
      });

      await trace.finish("blocked");

      return res.status(403).json({
        error: "Blocked at execution stage",
        reason: postCheck.reason,
        traceId: trace.getTraceId(),
      });
    }

    // =====================================================
    // ⚙️ STEP 7: AGENT EXECUTION
    // =====================================================
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

    // =====================================================
    // 📡 STEP 8: TRACE COMPLETE
    // =====================================================
    await trace.finish("success");

    // =====================================================
    // 📊 STEP 9: LEARNING BRAIN UPDATE
    // =====================================================
    const learningOutput = await learningBrain.computeAdaptiveWeights();

    const learningGate = mcpGovernor.validateLearningUpdate({
      agentBias: learningOutput.agentBias,
    });

    // =====================================================
    // 🧬 STEP 10: AUTONOMY ENGINE (CONTROLLED SELF-UPDATE)
    // =====================================================
    await autonomyEngine.runAutonomyCycle({
      learningOutput,
      governor: learningGate,
      traceId: trace.getTraceId(),
    });

    // =====================================================
    // 📤 RESPONSE
    // =====================================================
    return res.json({
      query,
      traceId: trace.getTraceId(),

      result: {
        answer:
          "MCP execution completed with full governed autonomous intelligence stack",
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
 * =========================
 * ROOT
 * =========================
 */
app.get("/", (_req, res) => {
  res.json({
    service: "KZDI MCP Platform",
    status: "running",
    architecture:
      "vector + graph + decision + governor + learning + autonomy + trace",
  });
});

/**
 * =========================
 * SERVER START
 * =========================
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on port ${PORT}`);
});
