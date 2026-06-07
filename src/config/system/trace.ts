import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

/**
 * MCP Trace Engine
 * Captures full request lifecycle for observability
 */
export class MCPTraceEngine {
  private traceId: string;
  private startTime: number;

  constructor() {
    this.traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.startTime = Date.now();
  }

  getTraceId() {
    return this.traceId;
  }

  async log(event: any) {
    await supabase.from("telemetry_events").insert([
      {
        trace_id: this.traceId,
        event_type: event.type,
        source_agent_id: event.agent || null,
        event_data: event,
        created_at: new Date().toISOString()
      }
    ]);
  }

  async logAgentExecution(agent: string, status: string, meta?: any) {
    return this.log({
      type: "agent_execution",
      agent,
      status,
      meta
    });
  }

  async logGraphTraversal(nodeIds: string[]) {
    return this.log({
      type: "graph_traversal",
      nodes: nodeIds
    });
  }

  async logVectorSearch(query: string, resultsCount: number) {
    return this.log({
      type: "vector_search",
      query,
      results: resultsCount
    });
  }

  async finish(finalStatus: string) {
    const duration = Date.now() - this.startTime;

    await this.log({
      type: "trace_complete",
      status: finalStatus,
      duration_ms: duration
    });
  }
}
