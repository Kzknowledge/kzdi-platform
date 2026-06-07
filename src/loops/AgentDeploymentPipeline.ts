import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { acquireLock, releaseLock } from "../utils/lock";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function runDeploymentPipeline() {
  const locked = await acquireLock("deployment");

  if (!locked) {
    console.log("⛔ Deployment skipped");
    return;
  }

  try {
    console.log("🚀 Deployment Pipeline START");

    const { data: agents } = await supabase
      .from("evolution_registry")
      .select("*")
      .eq("status", "approved");

    for (const agent of agents ?? []) {
      await supabase
        .from("evolution_registry")
        .update({
          status: "deployed"
        })
        .eq("id", agent.id);

      console.log("🟢 Deployed:", agent.new_agent_id);
    }

    console.log("📦 Deployment complete");

  } catch (err) {
    console.error("❌ Deployment error:", err);
  } finally {
    await releaseLock();
  }
}

runDeploymentPipeline();
