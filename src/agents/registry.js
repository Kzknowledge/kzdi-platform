'use strict';

/**
 * KZDI Agent Registry
 * MCP Pipeline — Agent Definition + Observability Layer
 * KZDI Technologies Ltd
 */

/**
 * NOTE:
 * This registry is now MCP-aware.
 * Agents can optionally emit execution traces via context.telemetry
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
 * Find agent by alias (MCP-friendly lookup)
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
 * Execute agent with optional MCP telemetry hook
 * (safe no-op if telemetry not provided)
 */
async function executeAgent(agentId, payload, context = {}) {
  const agent = getAgent(agentId);

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const startTime = Date.now();

  try {
    if (context.telemetry) {
      context.telemetry.log({
        type: 'agent_execution_start',
        agent: agentId,
        alias: agent.alias,
        timestamp: new Date().toISOString(),
      });
    }

    // Placeholder execution contract (actual logic lives elsewhere)
    const result = {
      agent: agentId,
      alias: agent.alias,
      status: 'executed',
      input: payload,
      processed_at: new Date().toISOString(),
    };

    if (context.telemetry) {
      context.telemetry.log({
        type: 'agent_execution_success',
        agent: agentId,
        duration_ms: Date.now() - startTime,
      });
    }

    return result;

  } catch (err) {
    if (context.telemetry) {
      context.telemetry.log({
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
