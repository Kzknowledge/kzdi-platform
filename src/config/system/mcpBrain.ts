import { MCPTraceEngine } from "./trace";
import { executeAgent, getAgent } from "../../agents/registry";
import { MCPExplanationEngine } from "./explanationEngine";

/**
 * MCP Brain Layer
 * Unified orchestration layer for decision + execution + explanation
 */

type VectorResult = { id: string; score: number };
type GraphNode = { id: string; weight?: number };

export class MCPBrain {
  private trace: MCPTraceEngine;
  private explainer: MCPExplanationEngine;

  constructor() {
    this.trace = new MCPTraceEngine();
    this.explainer = new MCPExplanationEngine();
  }

  getTraceId() {
    return this.trace.getTraceId();
  }

  /**
   * MAIN MCP ENTRY FUNCTION
   */
  async run(query: string) {
    try {
      // 🔷 STEP 1: TRACE REQUEST
      await this.trace.logRequestReceived(query);

      // 🔷 STEP 2: VECTOR LAYER (placeholder for pgvector)
      const vectorResults: VectorResult[] = [
        { id: "node_mcp_core", score: 0.93 },
        { id: "node_hausa_nlp", score: 0.89 }
      ];

      await this.trace.logVectorSearch(query, vectorResults);

      // 🔷 STEP 3: GRAPH LAYER (placeholder structure)
      const graphNodes: GraphNode[] = [
        { id: "node_mcp_core", weight: 0.8 },
        { id: "node_hausa_nlp", weight: 0.7 }
      ];

      await this.trace.logGraphTraversal(
        graphNodes.map(n => n.id),
        []
      );

      // 🔷 STEP 4: SIMPLE INTERNAL DECISION (lightweight routing)
      const selectedAgent = this.selectAgent(vectorResults, graphNodes);

      await this.trace.log({
        type: "agent_selected",
        agent: selectedAgent.id,
        alias: selectedAgent.alias
      });

      // 🔷 STEP 5: EXECUTE AGENT
      await this.trace.logAgentExecution(selectedAgent.id, "start");

      const agentResult = await executeAgent(
        selectedAgent.id,
        {
          query,
          context_nodes: graphNodes,
          vector_results: vectorResults
        },
        { trace: this.trace }
      );

      await this.trace.logAgentExecution(selectedAgent.id, "success");

      // 🔷 STEP 6: EXPLANATION ENGINE
      const explanation = this.explainer.explain({
        query,
        selectedAgent,
        vectorResults,
        graphNodes
      });

      // 🔷 STEP 7: FINAL TRACE
      await this.trace.finish("success");

      // 🔷 FINAL OUTPUT
      return {
        query,
        agent: agentResult,
        explanation,
        traceId: this.getTraceId()
      };

    } catch (err: any) {
      await this.trace.logRequestFailed(err.message);
      await this.trace.finish("failed");

      return {
        error: err.message,
        traceId: this.getTraceId()
      };
    }
  }

  /**
   * INTERNAL LIGHTWEIGHT DECISION FUNCTION
   * (kept simple since full decision engine is optional layer)
   */
  private selectAgent(vectorResults: VectorResult[], graphNodes: GraphNode[]) {
    const vectorStrength =
      vectorResults.reduce((sum, v) => sum + v.score, 0) /
      (vectorResults.length || 1);

    const graphStrength =
      graphNodes.reduce((sum, g) => sum + (g.weight ?? 0.5), 0) /
      (graphNodes.length || 1);

    // 🔷 RULE BASED HYBRID SELECTION
    if (vectorStrength > 0.9) {
      return getAgent("KZDI-CORE-AGENT-01")!;
    }

    if (graphStrength > 0.75) {
      return getAgent("KZDI-CORE-AGENT-02")!;
    }

    return getAgent("KZDI-CORE-AGENT-01")!;
  }
  }
