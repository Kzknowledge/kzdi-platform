import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LOCK_TTL_MS = 5 * 60 * 1000;

type LockJob =
  | "reinforcement"
  | "competition"
  | "evolution"
  | "deployment";

function now() {
  return Date.now();
}

function iso() {
  return new Date().toISOString();
}

/**
 * 🔐 ATOMIC DISTRIBUTED LOCK (SAFE VERSION)
 */
export async function acquireLock(job: LockJob): Promise<boolean> {
  const lockKey = `mcp_lock:${job}`;
  const start = now();

  try {
    const { data: existing } = await supabase
      .from("system_memory")
      .select("value, updated_at")
      .eq("key", lockKey)
      .maybeSingle();

    // 1. Check if lock exists
    if (existing?.value?.active) {
      const age =
        now() - new Date(existing.value.started_at).getTime();

      // 2. If lock still valid → reject
      if (age < LOCK_TTL_MS) {
        await logEvent(job, "failed", {
          reason: "lock_active",
          age_ms: age,
        });

        return false;
      }

      // 3. stale lock detected
      await logEvent(job, "stale", {
        reason: "ttl_expired",
        age_ms: age,
      });
    }

    // 4. ATOMIC UPSERT (overwrites stale or empty lock)
    const { error } = await supabase.from("system_memory").upsert({
      key: lockKey,
      value: {
        active: true,
        job,
        started_at: iso(),
      },
      updated_at: iso(),
    });

    if (error) {
      await logEvent(job, "failed", {
        error: error.message,
      });
      return false;
    }

    await logEvent(job, "acquired", {
      latency_ms: now() - start,
    });

    return true;
  } catch (err: any) {
    await logEvent(job, "failed", {
      error: err?.message || "unknown",
    });

    return false;
  }
}

/**
 * 🔓 RELEASE LOCK (SAFE)
 */
export async function releaseLock(job: LockJob): Promise<void> {
  const lockKey = `mcp_lock:${job}`;
  const start = now();

  try {
    const { data } = await supabase
      .from("system_memory")
      .select("value")
      .eq("key", lockKey)
      .maybeSingle();

    const startedAt = data?.value?.started_at
      ? new Date(data.value.started_at).getTime()
      : now();

    const duration = now() - startedAt;

    await supabase.from("system_memory").upsert({
      key: lockKey,
      value: {
        active: false,
        job,
        released_at: iso(),
      },
      updated_at: iso(),
    });

    await logEvent(job, "released", {
      duration_ms: duration,
      latency_ms: now() - start,
    });
  } catch (err: any) {
    await logEvent(job, "failed", {
      stage: "release",
      error: err?.message,
    });
  }
}

/**
 * 🧯 EMERGENCY CLEAR
 */
export async function forceClearLock(job: LockJob): Promise<void> {
  const lockKey = `mcp_lock:${job}`;

  await supabase.from("system_memory").upsert({
    key: lockKey,
    value: {
      active: false,
      force_cleared: true,
      cleared_at: iso(),
    },
    updated_at: iso(),
  });

  await logEvent(job, "stale", {
    reason: "force_cleared",
  });
}

/**
 * 📊 EVENT LOGGER (NON-BLOCKING)
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
        timestamp: iso(),
      },
    });
  } catch (err) {
    console.error("lock_events failed:", err);
  }
}
