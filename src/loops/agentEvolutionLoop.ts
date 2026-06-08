import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { acquireLock, releaseLock } from "../utils/lock";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function runEvolutionLoop() {
  const locked = await acquireLock("evolution");

  if (!locked) {
    console.log("⛔ Evolution skipped");
    return;
  }

  try {
    console.log("🧬 Evolution Loop START");

    const { data: agents } = await supabase
      .from("evolution_registry")
      .select("*")
      .eq("status", "pending");

    for (const agent of agents ?? []) {
      await supabase
        .from("evolution_registry")
        .update({
          status: "approved",
          mutation_type: agent.mutation_type
        })
        .eq("id", agent.id);
    }

    console.log("✅ Evolution processed:", agents?.length ?? 0);

  } catch (err) {
    console.error("❌ Evolution error:", err);
  } finally {
    await releaseLock();
  }
}

runEvolutionLoop();
