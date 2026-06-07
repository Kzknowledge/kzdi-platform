import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes safety window

type LockJob =
  | "reinforcement"
  | "competition"
  | "evolution"
  | "deployment";

function now() {
  return new Date().toISOString();
}

/**
 * 🧠 ACQUIRE DISTRIBUTED LOCK (AUTO-INSTRUMENTED)
 */
export async function acquireLock(job: LockJob): Promise<boolean> {
  const lockKey = `mcp_lock:${job}`;
  const start = Date.now();

  try {
    // 1. Check current lock state
    const { data } = await supabase
      .from("system_memory")
      .select("value")
      .eq("key", lockKey)
      .single();

    const existing = data?.value;

    // 2. Stale lock detection
    if (existing?.active) {
      const age = Date.now() - new Date(existing.started_at).getTime();

      if (age < LOCK_TTL_MS) {
        await logEvent(job, "failed", {
          reason: "lock_active",
          age_ms: age,
        });

        return false;
      }

      // stale recovery
      await logEvent(job, "stale", {
        reason: "ttl_expired",
        age_ms: age,
      });
    }

    // 3. Acquire lock
    await supabase.from("system_memory").upsert({
      key: lockKey,
      value: {
        active: true,
        job,
        started_at: now(),
      },
      updated_at: now(),
    });

    await logEvent(job, "acquired", {
      latency_ms: Date.now() - start,
    });

    return true;
  } catch (err: any) {
    await logEvent(job, "failed", {
      error: err?.message || "unknown_error",
    });

    return false;
  }
}

/**
 * 🧠 RELEASE LOCK (AUTO-INSTRUMENTED)
 */
export async function releaseLock(job: LockJob): Promise<void> {
  const lockKey = `mcp_lock:${job}`;
  const start = Date.now();

  try {
    const { data } = await supabase
      .from("system_memory")
      .select("value")
      .eq("key", lockKey)
      .single();

    const startedAt = data?.value?.started_at
      ? new Date(data.value.started_at).getTime()
      : Date.now();

    const duration = Date.now() - startedAt;

    await supabase.from("system_memory").upsert({
      key: lockKey,
      value: {
        active: false,
        job,
        released_at: now(),
      },
      updated_at: now(),
    });

    await logEvent(job, "released", {
      duration_ms: duration,
      latency_ms: Date.now() - start,
    });
  } catch (err: any) {
    await logEvent(job, "failed", {
      stage: "release",
      error: err?.message || "unknown_error",
    });
  }
}

/**
 * 🧠 FORCE CLEAR LOCK (EMERGENCY RECOVERY)
 */
export async function forceClearLock(job: LockJob): Promise<void> {
  const lockKey = `mcp_lock:${job}`;

  await supabase.from("system_memory").upsert({
    key: lockKey,
    value: {
      active: false,
      force_cleared: true,
      cleared_at: now(),
    },
    updated_at: now(),
  });

  await logEvent(job, "stale", {
    reason: "force_cleared",
  });
}

/**
 * 📊 CENTRALIZED EVENT LOGGER
 */
async function logEvent(
  job: LockJob,
  event_type: "acquired" | "released" | "failed" | "stale",
  metadata: Record<string, any> = {}
) {
  try {
    await supabase.from("lock_events").insert({
      job,
      event_type,
      metadata: {
        ...metadata,
        timestamp: now(),
      },
    });
  } catch (err) {
    // NEVER break system flow because of logging failure
    console.error("lock_events log failed:", err);
  }
}
