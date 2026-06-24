import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EDGE_SECRET = Deno.env.get("EDGE_SECRET")!;
const WORKER_URL = Deno.env.get("WORKER_URL")!;
const TELEMETRY_URL = Deno.env.get("TELEMETRY_URL")!;

const supabase = createClient(supabaseUrl, supabaseKey);

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
    const body = await req.json();

    const request_id = body.request_id || crypto.randomUUID();

    await logTelemetry({
      request_id,
      event: "evaluation_started",
      source: body.source || "unknown",
      timestamp: new Date().toISOString(),
    });

    // 🧠 SIMPLE DECISION ENGINE (upgrade later to AI model)
    let decision = "reject";

    if (body.payload?.score >= 70) {
      decision = "accept";
    } else if (body.payload?.score >= 40) {
      decision = "review";
    }

    const task = {
      request_id,
      decision,
      payload: body.payload,
    };

    // 🚀 SEND TO WORKER
    const workerRes = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-edge-secret": EDGE_SECRET,
      },
      body: JSON.stringify(task),
    });

    const workerData = await workerRes.json();

    await logTelemetry({
      request_id,
      event: "evaluation_completed",
      decision,
      latency_ms: Date.now() - start,
      worker_result: workerData,
    });

    return new Response(
      JSON.stringify({
        request_id,
        decision,
        result: workerData,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    await logTelemetry({
      event: "evaluation_error",
      error: String(err),
    });

    return new Response(
      JSON.stringify({ error: "evaluation_failed" }),
      { status: 500 }
    );
  }
});
