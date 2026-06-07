import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class EvolutionRegistry {
  async propose(agent: any) {
    const { data, error } = await supabase
      .from("agent_evolution")
      .insert({
        agent_id: agent.id,
        status: "pending",
        payload: agent,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
    return data;
  }

  async approve(agent_id: string) {
    const { error } = await supabase
      .from("agent_evolution")
      .update({ status: "approved" })
      .eq("agent_id", agent_id);

    if (error) throw error;
  }

  async getStatus(agent_id: string) {
    const { data } = await supabase
      .from("agent_evolution")
      .select("*")
      .eq("agent_id", agent_id)
      .single();

    return data;
  }
}
