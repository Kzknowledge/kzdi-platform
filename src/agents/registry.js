'use strict';

/**
 * KZDI Agent Registry
 * MCP Pipeline — Agent Definition + Execution + Trace Integration Layer
 * KZDI Technologies Ltd
 */

const AGENT_REGISTRY = [
  {
    id: 'KZDI-CORE-AGENT-01',
    alias: 'core-coordinator',
    role: 'Core Coordination Node',
    classification: 'INTERNAL-SECURE',
    capabilities: [
      'identity_verification',
      'incident_tracking',
      'knowledge_broadcast',
      'iso27001_audit'
    ],
    status: 'active',
    authorized_by: 'Kriptomech',
    mcp_layer: 'control',
  },

  {
    id: 'KZDI-CORE-AGENT-02',
    alias: 'infra-intel',
    role: 'Infrastructure Intelligence Layer',
    classification: 'INTERNAL-SECURE',
    capabilities: [
      'infrastructure_monitoring',
      'security_analysis',
      'pipeline_tracking',
      'nlp_systems'
    ],
    status: 'active',
    authorized_by: 'Kriptomech',
    mcp_layer: 'observability',
  },

  {
    id: 'KzMentorBot',
    alias: 'kzmentorbot',
    role: 'Community AI Mentor',
    classification: 'PUBLIC',
    capabilities: [
      'hausa_english_qa',
      'quiz_engine',
      'observability_delivery'
    ],
    status: 'active',
    platform: 'Telegram',
    authorized_by: 'Kriptomech',
    mcp_layer: 'interaction',
  },

  {
    id: 'KZDI-TALENT-OS',
    alias: 'talent-os',
    role: 'Talent Acquisition + Evaluation Bot',
    classification: 'INTERNAL',
    capabilities: [
      'candidate_intake',
      'ai_evaluation_0_100',
      'status_tracking'
    ],
    status: 'active',
    platform: 'Telegram + Vercel Dashboard',
    authorized_by: 'Kriptomech',
    mcp_layer: 'evaluation',
  },
];

/**
 * Find agent by ID
 */
function getAgent(agentId) {
  return AGENT_REGISTRY.find((a) => a.id === agentId);
}

/**
 * Find agent by alias (MCP routing safe)
 */
function getAgentByAlias(alias) {
  return AGENT_REGISTRY.find((a) => a.alias === alias);
}

/**
 * List agents by status
 */
function listByStatus(status) {
  return AGENT_REGISTRY.filter((a) => a.status === status);
}

/**
 * Execute agent with FULL MCP Trace + Telemetry support
 *
 * context can include:
 * - trace: MCPTraceEngine (preferred)
 * - telemetry: legacy fallback logger
 */
async function executeAgent(agentId, payload, context = {}) {
  const agent = getAgent(agentId);

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const startTime = Date.now();

  const trace = context.trace || null;
  const telemetry = context.telemetry || null;

  try {
    // 🔷 TRACE: start
    if (trace?.log) {
      await trace.log({
        type: 'agent_execution_start',
        agent: agentId,
        alias: agent.alias,
        timestamp: new Date().toISOString(),
      });
    }

    // 🔷 TELEMETRY fallback (legacy compatibility)
    if (!trace && telemetry?.log) {
      telemetry.log({
        type: 'agent_execution_start',
        agent: agentId,
      });
    }

    // 🔷 EXECUTION CONTRACT (placeholder layer)
    const result = {
      agent: agentId,
      alias: agent.alias,
      status: 'executed',
      input: payload,
      processed_at: new Date().toISOString(),
    };

    // 🔷 TRACE: success
    if (trace?.log) {
      await trace.log({
        type: 'agent_execution_success',
        agent: agentId,
        duration_ms: Date.now() - startTime,
      });
    }

    return result;

  } catch (err) {

    // 🔷 TRACE: failure
    if (trace?.log) {
      await trace.log({
        type: 'agent_execution_failed',
        agent: agentId,
        error: err.message,
      });
    }

    // 🔷 TELEMETRY fallback
    if (!trace && telemetry?.log) {
      telemetry.log({
        type: 'agent_execution_failed',
        agent: agentId,
        error: err.message,
      });
    }

    throw err;
  }
}

/**
 * Export registry + utilities
 */
module.exports = AGENT_REGISTRY;
module.exports.getAgent = getAgent;
module.exports.getAgentByAlias = getAgentByAlias;
module.exports.listByStatus = listByStatus;
module.exports.executeAgent = executeAgent;
