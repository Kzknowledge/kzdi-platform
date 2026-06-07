'use strict';

/**
 * MCP System Memory Engine (UPGRADED)
 * - Supabase-backed persistent system state
 * - Autonomy-safe update layer
 * - Versioned memory tracking
 * - Governance-ready metadata support
 */

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * READ SYSTEM MEMORY
 */
async function getSystemMemory(key) {
  const { data, error } = await supabase
    .from("system_memory")
    .select("*")
    .eq("key", key)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data?.value || null;
}

/**
 * WRITE SYSTEM MEMORY (CORE FUNCTION)
 * Now includes versioning + governance metadata
 */
async function setSystemMemory(key, value, meta = {}) {
  const existing = await getSystemMemory(key);

  const nextVersion =
    existing?.version ? existing.version + 1 : 1;

  const { error } = await supabase
    .from("system_memory")
    .upsert({
      key,
      value,

      // 🔥 VERSIONING (AUTONOMY TRACKING)
      version: meta.version || nextVersion,

      // 🔥 GOVERNANCE METADATA
      source: meta.source || "manual",
      reason: meta.reason || null,
      approved_by: meta.approved_by || null,

      updated_at: new Date().toISOString(),
    });

  if (error) throw error;

  return true;
}

/**
 * BATCH UPDATE (FOR AUTONOMY / LEARNING BRAINS)
 */
async function updateSystemMemoryBatch(updates = []) {
  for (const item of updates) {
    await setSystemMemory(
      item.key,
      item.value,
      item.meta || {}
    );
  }
}

/**
 * AUTONOMY SAFE UPDATE WRAPPER
 * Only used by MCPBrain AFTER Governor approval
 */
async function applySystemUpdate(key, value, meta = {}) {
  return setSystemMemory(key, value, {
    ...meta,
    source: "autonomy_engine",
    timestamp: new Date().toISOString(),
  });
}

/**
 * READ SYSTEM BIAS (USED BY MCPBRAIN DECISION LAYER)
 * This is how memory influences reasoning
 */
async function getSystemBias() {
  const vectorWeights = await getSystemMemory("vector_weights");
  const agentPolicy = await getSystemMemory("agent_policy");

  return {
    vectorWeights,
    agentPolicy,
  };
}

/**
 * APPLY AUTONOMY SIGNAL (LEGACY SUPPORT)
 */
async function applyAutonomySignal(signal) {
  if (!signal) return false;

  switch (signal.type) {
    case "vector_weight_increase":
      return applySystemUpdate("vector_weights", {
        bias: "increase",
        reason: signal.payload.reason,
      });

    case "agent_bias_adjustment":
      return applySystemUpdate("agent_policy", {
        strategy: "rebalance",
        reason: signal.payload.reason,
      });

    default:
      return false;
  }
}

/**
 * EXPORTS
 */
module.exports = {
  getSystemMemory,
  setSystemMemory,
  updateSystemMemoryBatch,
  applySystemUpdate,
  getSystemBias,
  applyAutonomySignal,
};
