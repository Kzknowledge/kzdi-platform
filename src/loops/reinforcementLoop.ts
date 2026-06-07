import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { acquireLock, releaseLock } from "../utils/lock";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 🧠 CORE LOOP (PURE LOGIC ONLY)
 * NEVER CALL DIRECTLY
 */
async function executeReinforcement() {
  const startTime = Date.now();

  const { data: signals } = await supabase
    .from("telemetry_events")
    .select("*")
    .gte(
      "created_at",
      new Date(Date.now() - 60 * 60 * 1000).toISOString()
    );

  const signalCount = signals?.length ?? 0;

  const vector_bias = Math.max(0.5, 1 - signalCount * 0.01);
  const graph_bias = Math.max(0.5, 1 - signalCount * 0.005);
  const stability_score = signalCount === 0 ? 0.5 : Math.min(1, signalCount / 100);

  const updated = {
    vector_bias,
    graph_bias,
    stability_score,
    updated_at: new Date().toISOString(),
  };

  await supabase.from("system_memory").upsert({
    key: "reinforcement_weights",
    value: updated,
    updated_at: new Date().toISOString(),
  });

  await supabase.from("telemetry_events").insert({
    event_type: "reinforcement_success",
    event_data: {
      signal_count: signalCount,
      duration_ms: Date.now() - startTime,
    },
  });

  console.log("📊 Signals loaded:", signalCount);
  console.log("🧠 Computed update:", updated);
  console.log("✅ Reinforcement update saved");
}

/**
 * 🔐 WRAPPED ENTRYPOINT (ONLY VALID EXECUTION PATH)
 */
export async function runReinforcementLoop() {
  console.log("🔁 MCP Reinforcement Loop START");

  const locked = await acquireLock("reinforcement");

  if (!locked) {
    console.log("⛔ Skipped (lock active)");
    return;
  }

  try {
    await executeReinforcement();
  } catch (err: any) {
    console.error("❌ Reinforcement error:", err);

    await supabase.from("telemetry_events").insert({
      event_type: "reinforcement_error",
      event_data: {
        error: err?.message || "unknown_error",
      },
    });
  } finally {
    await releaseLock("reinforcement");
  }
}

/**
 * 🚀 SINGLE ENTRY POINT (CRITICAL FIX)
 * Ensures ts-node ALWAYS uses correct execution path
 */
runReinforcementLoop();
