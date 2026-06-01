/**
 * KZDI Agent Registry
 * MCP Pipeline — Agent Definition Layer
 * KZDI Technologies Ltd
 */

'use strict';

const AGENT_REGISTRY = [
  {
    id: 'KZDI-CORE-AGENT-01',
    alias: 'officon',
    role: 'Core Coordination Node',
    classification: 'INTERNAL-SECURE',
    capabilities: [
      'identity_verification',
      'incident_tracking',
      'knowledge_broadcast',
      'iso27001_audit',
    ],
    status: 'active',
    authorized_by: 'Kriptomech',
  },
  {
    id: 'KZDI-CORE-AGENT-02',
    alias: 'officon',
    role: 'Infrastructure Intelligence Layer',
    classification: 'INTERNAL-SECURE',
    capabilities: [
      'infrastructure_monitoring',
      'security_analysis',
      'pipeline_tracking',
      'nlp_systems',
    ],
    status: 'active',
    authorized_by: 'Kriptomech',
  },
  {
    id: 'KzMentorBot',
    alias: 'telegram-bot',
    role: 'Community AI Mentor',
    classification: 'PUBLIC',
    capabilities: [
      'hausa_english_qa',
      'quiz_engine',
      'observability_delivery',
    ],
    status: 'active',
    platform: 'Telegram',
    authorized_by: 'Kriptomech',
  },
  {
    id: 'KZDI-TALENT-OS',
    alias: 'talent-bot',
    role: 'Talent Acquisition + Evaluation Bot',
    classification: 'INTERNAL',
    capabilities: [
      'candidate_intake',
      'ai_evaluation_0_100',
      'status_tracking',
    ],
    status: 'active',
    platform: 'Telegram + Vercel Dashboard',
    authorized_by: 'Kriptomech',
  },
];

/**
 * Find agent by ID
 * @param {string} agentId
 * @returns {object|undefined}
 */
function getAgent(agentId) {
  return AGENT_REGISTRY.find((a) => a.id === agentId);
}

/**
 * List agents by status
 * @param {string} status
 * @returns {object[]}
 */
function listByStatus(status) {
  return AGENT_REGISTRY.filter((a) => a.status === status);
}

module.exports = AGENT_REGISTRY;
module.exports.getAgent = getAgent;
module.exports.listByStatus = listByStatus;

