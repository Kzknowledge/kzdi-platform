/**
 * KZDI System Memory Configuration
 * MCP Pipeline — Memory + Context Layer
 * KZDI Technologies Ltd
 */

'use strict';

const SYSTEM_MEMORY = {
  version: '1.0.0',
  organization: 'KZDI Technologies Ltd',

  pipeline: {
    stages: [
      'INGESTION',
      'VALIDATION',
      'LLM_PROPOSAL',
      'VALIDATION',
      'GOLD',
      'HUMAN_REVIEW',
      'DATASET',
    ],
    confidence_threshold: 0.75,
    quarantine_enabled: true,
    human_in_loop: true,
    direct_llm_to_db: false, // SECURITY: never allow direct LLM→DB writes
  },

  security: {
    rls_enforced: true,
    audit_logging: false,    // AUDIT-001: immutable logging pending NDPR compliance
    edge_secret_active: false, // EDGE-001: bearer token pending
    supabase_security_advisor: '0_errors_0_warnings_0_suggestions',
    iso27001_progress: '49_percent_108_steps',
  },

  active_incidents: {
    INC_001: {
      description: 'security-migrations.yml ENOTFOUND — psql dotted-username fix deployed',
      status: 'fix_deployed_pending_verification',
    },
    INC_002: {
      description: 'telemetry_events schema partial — 10 columns known from Google Form',
      status: 'open',
    },
    INC_003: {
      description: 'Make.com Phase 2 payload binding in progress',
      status: 'in_progress',
    },
    INC_004: {
      description: 'package-lock.json missing — CI cache failure',
      status: 'fix_in_deployment',
    },
  },

  open_gaps: {
    GAP_001: 'telemetry_events full column schema unconfirmed',
    GAP_003: 'TabibAI revenue events not instrumented',
    GAP_004: 'Hausa NLP dataset at 50 samples — below production threshold',
  },

  /**
   * Get all active (non-closed) incidents
   * @returns {object}
   */
  getActiveIncidents() {
    return Object.entries(this.active_incidents)
      .filter(([, v]) => v.status !== 'closed')
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  },

  /**
   * Validate memory config integrity — used by CI workflow
   * @returns {boolean}
   */
  validate() {
    if (!Array.isArray(this.pipeline.stages) || this.pipeline.stages.length === 0) {
      throw new Error('System memory: pipeline stages array is empty or invalid');
    }
    if (this.pipeline.direct_llm_to_db === true) {
      throw new Error('SECURITY VIOLATION: direct_llm_to_db must be false');
    }
    return true;
  },
};

// Security validation on import
SYSTEM_MEMORY.validate();

module.exports = SYSTEM_MEMORY;

