import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

import { AGENT_REGISTRY } from "../agents/registry";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 🚀 AGENT DEPLOYMENT PIPELINE
 * Activates approved evolutionary agents into runtime
 */
async function runDeploymentPipeline() {
  console.log("🚀 AGENT DEPLOYMENT PIPELINE START");

  // ===============================
  // 1. FETCH APPROVED AGENTS
  // ===============================
  const { data: approvedAgents, error } = await supabase
    .from("evolution_registry")
    .select("*")
    .eq("status", "approved");

  if (error) {
    console.error("❌ Fetch error:", error);
    return;
  }

  console.log("📦 Approved agents:", approvedAgents?.length ?? 0);

  // ===============================
  // 2. DEPLOY NEW AGENTS
  // ===============================
  for (const agent of approvedAgents ?? []) {
    const agentId = agent.new_agent_id;

    // Prevent duplicates
    if (AGENT_REGISTRY[agentId]) {
      continue;
    }

    // ===============================
    // 3. CREATE RUNTIME AGENT WRAPPER
    // ===============================
    AGENT_REGISTRY[agentId] = {
      id: agentId,
      parent: agent.parent,
      mutation_type: agent.mutation_type,

      run: async (input: any) => {
        return {
          output: `🧬 Evolved agent ${agentId} executed`,
          metadata: {
            expected_bias: agent.expected_bias,
            origin: agent.parent,
          },
        };
      },
    };

    console.log("🟢 DEPLOYED AGENT:", agentId);

    // ===============================
    // 4. MARK AS DEPLOYED
    // ===============================
    await supabase
      .from("evolution_registry")
      .update({ status: "deployed" })
      .eq("id", agent.id);
  }

  // ===============================
  // 5. SYSTEM STATUS
  // ===============================
  console.log("🧠 ACTIVE AGENTS:", Object.keys(AGENT_REGISTRY));
}

runDeploymentPipeline().catch(console.error);
