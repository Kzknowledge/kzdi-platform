import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

import { on, emit } from "./eventBus";
import { acquireLock, releaseLock } from "../utils/lock";
import { runCompetition } from "../agents/multiAgentCompetition";
import { runEvolutionEngine } from "../agents/agentEvolutionEngine";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 🧠 EVENT: TELEMETRY INCOMING
 */
on("telemetry_event", async (event) => {
  console.log("📥 Telemetry received");

  // Trigger RL only if signal threshold reached
  const signals = await supabase
    .from("telemetry_events")
    .select("*")
    .limit(100);

  const count = signals.data?.length || 0;

  if (count % 5 !== 0) return; // simple pressure trigger

  await emit({
    type: "reinforcement_trigger",
    data: { reason: "signal_threshold", count },
    timestamp: new Date().toISOString(),
  });
});

/**
 * 🧠 EVENT: RL TRIGGER → FULL EXECUTION
 */
on("reinforcement_trigger", async (event) => {
  console.log("⚡ RL TRIGGERED:", event.data);

  const locked = await acquireLock("reinforcement");

  if (!locked) {
    await emit({
      type: "lock_failed",
      data: event.data,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    // ⚔️ COMPETITION PHASE
    const winner = await runCompetition();

    await emit({
      type: "competition_run",
      data: winner,
      timestamp: new Date().toISOString(),
    });

    // 🧬 EVOLUTION PHASE
    await runEvolutionEngine();

    await emit({
      type: "agent_evolution",
      data: { status: "completed" },
      timestamp: new Date().toISOString(),
    });

    // 💾 REINFORCEMENT UPDATE
    await supabase.from("system_memory").upsert({
      key: "rl_last_cycle",
      value: {
        winner: winner.agent_id,
        score: winner.score,
        timestamp: new Date().toISOString(),
      },
    });

    console.log("✅ RL cycle complete");

  } finally {
    await releaseLock("reinforcement");
  }
});
