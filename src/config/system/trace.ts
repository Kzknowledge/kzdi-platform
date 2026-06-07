import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

/**
 * MCP Trace Engine v2
 * - Full lifecycle tracing
 * - Graph + Vector + Agent observability
 * - Fault-tolerant telemetry logging
 */

export class MCPTraceEngine {
  private traceId: string;
  private startTime: number;
  private buffer: any[] = [];

  constructor() {
    this.traceId = `trace_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;

    this.startTime = Date.now();
  }

  getTraceId() {
    return this.traceId;
  }

  /**
   * Safe logger (never breaks execution flow)
   */
  async log(event: any) {
    const enrichedEvent = {
      trace_id: this.traceId,
      event_type: event.type,
      source_agent_id: event.agent || null,
      event_data: event,
      created_at: new Date().toISOString()
    };

    try {
      await supabase.from("telemetry_events").insert([enrichedEvent]);
    } catch (err) {
      // fallback buffer (prevents system failure)
      this.buffer.push(enrichedEvent);
      console.error("Trace log failed, buffered:", err);
    }
  }

  /**
   * Request lifecycle tracking
   */
  async logRequestReceived(query: string) {
    return this.log({
      type: "request_received",
      query
    });
  }

  async logRequestFailed(error: string) {
    return this.log({
      type: "request_failed",
      error
    });
  }

  /**
   * Agent execution tracking (enhanced)
   */
  async logAgentExecution(
    agent: string,
    status: "start" | "success" | "failed",
    meta?: any
  ) {
    return this.log({
      type: "agent_execution",
      agent,
      status,
      meta
    });
  }

  /**
   * Graph traversal (structured)
   */
  async logGraphTraversal(
    nodeIds: string[],
    edges: any[] = []
  ) {
    return this.log({
      type: "graph_traversal",
      nodes: nodeIds,
      edges,
      node_count: nodeIds.length,
      edge_count: edges.length
    });
  }

  /**
   * Vector search tracking (structured results)
   */
  async logVectorSearch(
    query: string,
    results: any[] = []
  ) {
    return this.log({
      type: "vector_search",
      query,
      results_count: results.length,
      top_result_score: results[0]?.score || null,
      results
    });
  }

  /**
   * Generic structured event (future-proofing)
   */
  async logEvent(type: string, data: any = {}) {
    return this.log({
      type,
      ...data
    });
  }

  /**
   * Finish trace with full metrics
   */
  async finish(finalStatus: "success" | "failed") {
    const duration = Date.now() - this.startTime;

    return this.log({
      type: "trace_complete",
      status: finalStatus,
      duration_ms: duration,
      buffered_events: this.buffer.length
    });
  }
}
