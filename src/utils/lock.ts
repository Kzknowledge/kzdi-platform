import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function acquireLock(job: string) {
  const { data } = await supabase
    .from("system_memory")
    .select("value")
    .eq("key", "mcp_lock")
    .single();

  const lock = data?.value;

  if (lock?.active) return false;

  await supabase.from("system_memory").upsert({
    key: "mcp_lock",
    value: {
      active: true,
      job,
      started_at: new Date().toISOString(),
    },
  });

  return true;
}

export async function releaseLock() {
  await supabase.from("system_memory").upsert({
    key: "mcp_lock",
    value: { active: false },
  });
}
