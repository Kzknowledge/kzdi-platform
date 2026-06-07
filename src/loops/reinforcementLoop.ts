import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { acquireLock, releaseLock } from "../utils/lock";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function runReinforcementLoop() {
  const locked = await acquireLock("reinforcement");

  if (!locked) {
    console.log("⛔ Reinforcement skipped (lock active)");
    return;
  }

  try {
    console.log("🔁 Reinforcement Loop START");

    const { data: signals } = await supabase
      .from("telemetry_events")
      .select("*")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    console.log("📊 Signals loaded:", signals?.length ?? 0);

    const vector_bias = signals?.length ? 0.95 : 1;
    const graph_bias = signals?.length ? 0.95 : 1;

    const updated = {
      vector_bias,
      graph_bias,
      stability_score: 0.5,
      updated_at: new Date().toISOString()
    };

    await supabase
      .from("system_memory")
      .upsert({
        key: "reinforcement_weights",
        value: updated
      });

    console.log("✅ Reinforcement update saved");

  } catch (err) {
    console.error("❌ Reinforcement error:", err);
  } finally {
    await releaseLock();
  }
}

runReinforcementLoop();
