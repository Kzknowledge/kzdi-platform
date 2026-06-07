import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

import { acquireLock, releaseLock } from "../utils/lock";
import { runCompetition } from "../agents/multiAgentCompetition";
import { runEvolutionEngine } from "../agents/agentEvolutionEngine";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 🧠 UNIQUE WORKER ID (critical for distributed debugging)
 */
const WORKER_ID = `worker_${Math.random().toString(36).slice(2, 10)}`;

console.log("🧠 RL WORKER STARTED:", WORKER_ID);

/**
 * 🔁 CLAIM NEXT AVAILABLE EVENT (ATOMIC SAFE LOCK)
 */
async function claimEvent() {
  const { data } = await supabase
    .from("rl_event_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  const event = data?.[0];

  if (!event) return null;

  // ⚠️ ATOMIC CLAIM STEP
  const { error } = await supabase
    .from("rl_event_queue")
    .update({
      status: "processing",
      worker_id: WORKER_ID,
      updated_at: new Date().toISOString(),
    })
    .eq("id", event.id)
    .eq("status", "pending");

  if (error) {
    // Another worker already took it
    return null;
  }

  return event;
}

/**
 * ⚔️ PROCESS RL EVENT
 */
async function processEvent(event: any) {
  try {
    console.log(`📥 Processing event: ${event.event_type}`);

    switch (event.event_type) {
      /**
       * 🧠 MAIN RL TRIGGER
       */
      case "reinforcement_trigger": {
        const locked = await acquireLock("reinforcement");

        if (!locked) {
          console.log("⛔ RL locked, skipping event");
          return;
        }

        try {
          // ⚔️ COMPETITION PHASE
          const winner = await runCompetition();

          // 🧬 EVOLUTION PHASE
          await runEvolutionEngine();

          console.log(
            `🏆 Winner: ${winner.agent_id} | score: ${winner.score}`
          );

        } finally {
          await releaseLock("reinforcement");
        }

        break;
      }

      /**
       * 🧪 FUTURE EXTENSIONS
       */
      case "agent_evolution":
      case "competition_run":
      case "telemetry_event": {
        console.log("ℹ️ Non-critical event ignored:", event.event_type);
        break;
      }

      default:
        console.log("⚠️ Unknown event type:", event.event_type);
    }

    // ✅ MARK EVENT AS DONE
    await supabase
      .from("rl_event_queue")
      .update({
        status: "done",
        updated_at: new Date().toISOString(),
      })
      .eq("id", event.id);

  } catch (err: any) {
    console.error("❌ Event processing failed:", err);

    // ❌ MARK EVENT FAILED (for retries/debugging)
    await supabase
      .from("rl_event_queue")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
        payload: {
          ...event.payload,
          error: err?.message || "unknown_error",
        },
      })
      .eq("id", event.id);
  }
}

/**
 * 🔁 WORKER LOOP (CONTINUOUS EXECUTION ENGINE)
 */
export async function runWorkerLoop() {
  console.log("🚀 Worker loop started:", WORKER_ID);

  while (true) {
    try {
      const event = await claimEvent();

      if (!event) {
        // 💤 idle backoff (prevents CPU waste)
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      await processEvent(event);

    } catch (err) {
      console.error("❌ Worker loop error:", err);

      // 💤 safety backoff
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/**
 * 🚀 AUTO START IF RUN DIRECTLY
 */
runWorkerLoop();
