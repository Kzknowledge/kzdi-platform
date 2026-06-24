const EDGE_SECRET = Deno.env.get("EDGE_SECRET")!;
const TELEMETRY_URL = Deno.env.get("TELEMETRY_URL")!;

function logTelemetry(event: any) {
  fetch(TELEMETRY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-edge-secret": EDGE_SECRET,
    },
    body: JSON.stringify(event),
  });
}

Deno.serve(async (req) => {
  const start = Date.now();

  try {
    const auth = req.headers.get("x-edge-secret");

    if (auth !== EDGE_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const task = await req.json();

    await logTelemetry({
      request_id: task.request_id,
      event: "worker_started",
      timestamp: new Date().toISOString(),
    });

    // ⚙️ EXECUTION LOGIC (expandable pipeline)
    let result;

    switch (task.decision) {
      case "accept":
        result = {
          status: "processed",
          action: "onboard_user",
        };
        break;

      case "review":
        result = {
          status: "queued",
          action: "human_review_required",
        };
        break;

      default:
        result = {
          status: "rejected",
          action: "no_action",
        };
    }

    await logTelemetry({
      request_id: task.request_id,
      event: "worker_completed",
      latency_ms: Date.now() - start,
      result,
    });

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    await logTelemetry({
      event: "worker_error",
      error: String(err),
    });

    return new Response("Worker failed", { status: 500 });
  }
});
