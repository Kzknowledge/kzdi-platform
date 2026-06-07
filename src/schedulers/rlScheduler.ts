import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { acquireLock, releaseLock } from "../utils/lock";
import { runReinforcementLoop } from "../loops/reinforcementLoop";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 🧠 READ SYSTEM PRESSURE FROM LOCK EVENTS
 */
async function getSystemPressure(): Promise<number> {
  const { data } = await supabase
    .from("lock_events")
    .select("*")
    .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

  const events = data || [];

  const failures = events.filter(e => e.event_type === "failed").length;
  const active = events.filter(e => e.event_type === "acquired").length;

  // pressure score: 0 (calm) → 1 (overloaded)
  const pressure = Math.min(1, (failures * 2 + active) / 20);

  return pressure;
}

/**
 * 🧠 ADAPTIVE THROTTLE ENGINE
 */
function computeDelayMs(pressure: number): number {
  if (pressure < 0.2) return 0;        // full speed
  if (pressure < 0.5) return 2000;     // light throttle
  if (pressure < 0.8) return 5000;     // medium throttle
  return 15000;                        // heavy backoff
}

/**
 * 🧠 MAIN SCHEDULER ENTRYPOINT
 */
export async function runRLScheduler() {
  console.log("🧠 RL Scheduler START");

  const pressure = await getSystemPressure();
  const delay = computeDelayMs(pressure);

  console.log("📊 System pressure:", pressure.toFixed(2));
  console.log("⏳ Computed delay:", delay, "ms");

  // 🔐 global scheduler lock (prevents duplicate runs)
  const locked = await acquireLock("reinforcement");

  if (!locked) {
    console.log("⛔ Scheduler skipped (lock active)");
    return;
  }

  try {
    if (delay > 0) {
      console.log("⏳ Throttling RL execution...");
      await new Promise(res => setTimeout(res, delay));
    }

    // 🚀 EXECUTE ACTUAL RL LOOP
    await runReinforcementLoop();

  } catch (err: any) {
    console.error("❌ Scheduler error:", err);
  } finally {
    await releaseLock("reinforcement");
  }
}

/**
 * 🚀 EXECUTE
 */
runRLScheduler();
