import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { acquireLock, releaseLock } from "../utils/lock";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ReinforcementState = {
  vector_bias: number;
  graph_bias: number;
  stability_score: number;
  updated_at: string;
};

export async function runReinforcementLoop() {
  const startTime = Date.now();

  const locked = await acquireLock("reinforcement");

  if (!locked) {
    console.log("⛔ Reinforcement skipped (lock active)");
    return;
  }

  try {
    console.log("🔁 MCP Reinforcement Loop START");

    // 1. Fetch telemetry signals
    const { data: signals, error } = await supabase
      .from("telemetry_events")
      .select("*")
      .gte(
        "created_at",
        new Date(Date.now() - 60 * 60 * 1000).toISOString()
      );

    if (error) {
      console.error("❌ Telemetry fetch failed:", error);
    }

    const signalCount = signals?.length ?? 0;
    console.log("📊 Signals loaded:", signalCount);

    // 2. Compute reinforcement update (simple RL heuristic baseline)
    const vector_bias = Math.max(0.5, 1 - signalCount * 0.01);
    const graph_bias = Math.max(0.5, 1 - signalCount * 0.005);

    const stability_score =
      signalCount === 0 ? 0.5 : Math.min(1, signalCount / 100);

    const updated: ReinforcementState = {
      vector_bias,
      graph_bias,
      stability_score,
      updated_at: new Date().toISOString(),
    };

    // 3. Persist to system_memory
    await supabase.from("system_memory").upsert({
      key: "reinforcement_weights",
      value: updated,
      updated_at: new Date().toISOString(),
    });

    console.log("🧠 Computed update:", updated);
    console.log("✅ Reinforcement update saved");

    const duration = Date.now() - startTime;

    // optional: log success event into telemetry
    await supabase.from("telemetry_events").insert({
      event_type: "reinforcement_success",
      event_data: {
        signal_count: signalCount,
        duration_ms: duration,
      },
    });
  } catch (err: any) {
    console.error("❌ Reinforcement loop error:", err);

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

// Auto-run when executed directly
runReinforcementLoop();
