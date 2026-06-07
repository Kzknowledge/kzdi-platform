import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 📊 FETCH AGENT EVOLUTION STATE
 */
export async function getAgentPopulation() {
  const { data } = await supabase
    .from("system_memory")
    .select("*")
    .eq("key", "agent_population")
    .single();

  return data?.value || [];
}

/**
 * ⚔️ FETCH COMPETITION HISTORY
 */
export async function getCompetitionHistory(limit = 20) {
  const { data } = await supabase
    .from("telemetry_events")
    .select("*")
    .eq("event_type", "competition_run")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * 🧬 FETCH EVOLUTION HISTORY
 */
export async function getEvolutionHistory(limit = 20) {
  const { data } = await supabase
    .from("telemetry_events")
    .select("*")
    .eq("event_type", "agent_evolution")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * 🔐 FETCH LOCK ACTIVITY
 */
export async function getLockEvents(limit = 20) {
  const { data } = await supabase
    .from("lock_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * 🧠 SYSTEM HEALTH SUMMARY
 */
export async function getSystemHealth() {
  const [locks, comp, evo] = await Promise.all([
    getLockEvents(50),
    getCompetitionHistory(50),
    getEvolutionHistory(50),
  ]);

  const failures =
    locks.filter((l: any) => l.event_type === "failed").length;

  const evolutions = evo.length;
  const competitions = comp.length;

  const stability = Math.max(
    0,
    1 - failures / Math.max(1, locks.length)
  );

  return {
    stability,
    failures,
    evolutions,
    competitions,
    lock_events: locks.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 🖥️ CLI DASHBOARD RENDERER
 */
export async function renderDashboard() {
  console.clear();

  console.log("🧠 ===============================");
  console.log("   RL SYSTEM OBSERVABILITY");
  console.log("===============================");

  const health = await getSystemHealth();
  const agents = await getAgentPopulation();

  console.log("\n📊 SYSTEM HEALTH");
  console.log("----------------");
  console.log("Stability:", health.stability.toFixed(2));
  console.log("Failures:", health.failures);
  console.log("Competitions:", health.competitions);
  console.log("Evolutions:", health.evolutions);

  console.log("\n🤖 AGENT POPULATION");
  console.log("-------------------");
  console.log("Total agents:", agents.length);

  const top = agents
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 5);

  top.forEach((a: any, i: number) => {
    console.log(
      `${i + 1}. ${a.id} | score: ${a.score?.toFixed?.(3) ?? 0}`
    );
  });

  console.log("\n🔐 LOCK ACTIVITY");
  console.log("----------------");
  const locks = await getLockEvents(5);
  locks.forEach((l: any) => {
    console.log(`${l.event_type} → ${l.job}`);
  });

  console.log("\n⏱️ last updated:", health.timestamp);
}

/**
 * 🚀 RUN DASHBOARD
 */
renderDashboard();
