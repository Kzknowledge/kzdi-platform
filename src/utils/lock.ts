import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes safety timeout

type LockKey =
  | "reinforcement"
  | "competition"
  | "evolution"
  | "deployment";

/**
 * 🔐 ACQUIRE DISTRIBUTED MCP LOCK
 * Prevents concurrent loop execution across GitHub Actions runners
 */
export async function acquireLock(job: LockKey): Promise<boolean> {
  const key = `mcp_lock:${job}`;

  // 1. Fetch existing lock
  const { data } = await supabase
    .from("system_memory")
    .select("value, updated_at")
    .eq("key", key)
    .single();

  const now = Date.now();

  // 2. Check if lock exists and is still active
  if (data?.value?.active) {
    const startedAt = new Date(
      data?.value?.started_at || 0
    ).getTime();

    // stale lock recovery
    if (now - startedAt < LOCK_TTL_MS) {
      console.log(`⛔ Lock active for ${job}`);
      return false;
    }

    console.log(`🧹 Stale lock cleared for ${job}`);
  }

  // 3. Acquire lock
  const { error } = await supabase.from("system_memory").upsert({
    key,
    value: {
      active: true,
      job,
      started_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("❌ Lock acquisition failed:", error);
    return false;
  }

  return true;
}

/**
 * 🔓 RELEASE MCP LOCK
 */
export async function releaseLock(job: LockKey): Promise<void> {
  const key = `mcp_lock:${job}`;

  const { error } = await supabase.from("system_memory").upsert({
    key,
    value: {
      active: false,
      job,
      released_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("❌ Lock release failed:", error);
  }
}

/**
 * 🧠 FORCE CLEAR LOCK (EMERGENCY USE ONLY)
 */
export async function forceClearLock(job: LockKey): Promise<void> {
  const key = `mcp_lock:${job}`;

  await supabase.from("system_memory").upsert({
    key,
    value: {
      active: false,
      force_cleared: true,
      cleared_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  });

  console.log(`🧠 Force cleared lock: ${job}`);
}
