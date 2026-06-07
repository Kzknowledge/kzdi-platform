import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

/**
 * MCP REINFORCEMENT LOOP
 * Runs every 5 minutes via GitHub Actions
 */

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Load reinforcement weights safely
 */
async function getWeights() {
  const { data, error } = await supabase
    .from("system_memory")
    .select("*")
    .eq("key", "reinforcement_weights")
    .single();

  if (error) {
    console.error("❌ Failed to load reinforcement weights", error);
    return null;
  }

  return data?.value || null;
}

/**
 * Fetch recent telemetry signals
 */
async function getSignals(limit = 50) {
  const { data, error } = await supabase
    .from("telemetry_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("❌ Telemetry fetch failed", error);
    return [];
  }

  return data || [];
}

/**
 * Compute simple reinforcement update
 */
function computeUpdate(signals: any[]) {
  let successCount = 0;

  for (const s of signals) {
    if (s.event_type?.includes("success")) {
      successCount++;
    }
  }

  const successRate = signals.length
    ? successCount / signals.length
    : 0.5;

  return {
    vector_bias: 1 + (successRate - 0.5) * 0.2,
    graph_bias: 1 + (successRate - 0.5) * 0.1,
    stability_score: Math.min(1, Math.max(0.5, successRate)),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Save updated weights
 */
async function saveWeights(updated: any, current: any) {
  const merged = {
    ...current,
    ...updated,
  };

  const { error } = await supabase
    .from("system_memory")
    .update({ value: merged })
    .eq("key", "reinforcement_weights");

  if (error) {
    console.error("❌ Failed to update weights", error);
    throw error;
  }

  return merged;
}

/**
 * MAIN LOOP
 */
async function run() {
  console.log("🔁 MCP Reinforcement Loop START");

  try {
    const current = await getWeights();
    const signals = await getSignals(50);

    console.log(`📊 Signals loaded: ${signals.length}`);

    if (!current) {
      console.log("⚠️ No reinforcement weights found");
      return;
    }

    const update = computeUpdate(signals);

    console.log("🧠 Computed update:", update);

    const result = await saveWeights(update, current);

    console.log("✅ Reinforcement update saved");
    console.log("📦 New state:", result);
  } catch (err) {
    console.error("❌ Reinforcement loop crashed:", err);
    process.exit(1);
  }
}

run();
