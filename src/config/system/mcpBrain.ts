import { MCPDecisionEngine } from "./decisionEngine";
import { MCPGovernor } from "./mcpGovernor";
import { MCPLearningBrain } from "./learningBrain";
import { MCPAutonomyEngine } from "./autonomyEngine";

import { executeAgent, AGENT_REGISTRY } from "../../agents/registry";

type VectorResult = { id: string; score: number };
type GraphEdge = { from_node_id: string; to_node_id: string; label: string };

export class MCPBrain {
  private decisionEngine = new MCPDecisionEngine();
  private learningBrain = new MCPLearningBrain();
  private autonomyEngine = new MCPAutonomyEngine();
  private governor = new MCPGovernor();

  /**
   * SINGLE ENTRY POINT FOR ALL MCP EXECUTION
   */
  async run(input: {
    query: string;
    vectorResults: VectorResult[];
    graphEdges: GraphEdge[];
    trace: any;
  }) {
    const { query, vectorResults, graphEdges, trace } = input;

    // 🔒 STEP 1: GOVERNOR PRE-CHECK
    await this.governor.preCheck({ query });

    await trace.log({ type: "governor_precheck_passed" });

    // 🔷 STEP 2: AGENT SELECTION (ONLY ONE AUTHORITY)
    const decision = this.decisionEngine.selectAgent({
      query,
      vectorResults,
      graphNodes: graphEdges.map((e) => e.from_node_id),
      agents: AGENT_REGISTRY,
    });

    await trace.log({
      type: "agent_selected",
      agent: decision.id,
      score: decision.score,
    });

    // 🔷 STEP 3: AGENT EXECUTION
    await trace.logAgentExecution(decision.id, "start");

    const result = await executeAgent(
      decision.id,
      {
        query,
        vector_results: vectorResults,
        graph_edges: graphEdges,
      },
      { trace }
    );

    await trace.logAgentExecution(decision.id, "success");

    // 🔷 STEP 4: TRACE COMPLETION EVENT
    await trace.log({
      type: "execution_complete",
      agent: decision.id,
    });

    // 🔷 STEP 5: LEARNING UPDATE (READ ONLY)
    const learning = await this.learningBrain.fetchRecentSignals(50);

    await trace.log({
      type: "learning_snapshot",
      count: learning.length,
    });

    // 🔷 STEP 6: AUTONOMY PROPOSAL (NO WRITE YET)
    const autonomySignal =
      await this.autonomyEngine.analyze?.(learning);

    await trace.log({
      type: "autonomy_evaluated",
      hasSignal: !!autonomySignal,
    });

    // 🔒 STEP 7: GOVERNOR POST-CHECK
    await this.governor.postCheck({
      query,
      agent: decision.id,
    });

    await trace.finish("success");

    return {
      agent: decision,
      result,
      learning_snapshot: learning.length,
      autonomy_signal: autonomySignal || null,
    };
  }
}
