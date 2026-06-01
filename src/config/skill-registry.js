/**
 * KZDI Skill Registry
 * MCP Pipeline — Skill Configuration Layer
 * KZDI Technologies Ltd
 */

'use strict';

const SKILL_REGISTRY = {
  version: '1.0.0',
  organization: 'KZDI Technologies Ltd',
  maintainer: 'Kriptomech',

  skills: {
    hausa_nlp: {
      id: 'hausa_nlp',
      name: 'Hausa NLP Classifier',
      version: '0.1.0',
      status: 'pre-training',
      dimensions: ['Fanni', "Ra'ayi", 'Niyya', 'Hali'],
      dataset_size: 50,
      confidence_threshold: 0.75,
      language: 'ha',
      description: 'Intent classification for Hausa-language inputs',
    },

    supabase_query: {
      id: 'supabase_query',
      name: 'Supabase Query Executor',
      version: '1.0.0',
      status: 'live',
      rls_enforced: true,
      schema: 'public',
      description: 'Executes validated queries via MCP gateway with RLS',
    },

    telemetry_ingestion: {
      id: 'telemetry_ingestion',
      name: 'Telemetry Ingestion Skill',
      version: '1.2.0',
      status: 'live',
      pipeline_stage: 'INGESTION',
      streams: ['piictda', 'hausa_nlp'],
      description: 'Receives and validates incoming telemetry events',
    },

    human_review: {
      id: 'human_review',
      name: 'Human Review Gate',
      version: '1.0.0',
      status: 'live',
      pipeline_stage: 'HUMAN_REVIEW',
      quarantine_on_low_confidence: true,
      description: 'Blocks low-confidence LLM proposals for founder review',
    },
  },

  /**
   * Retrieve a skill definition by ID
   * @param {string} skillId
   * @returns {object|null}
   */
  getSkill(skillId) {
    return this.skills[skillId] || null;
  },

  /**
   * List all skills with a given status
   * @param {string} status - 'live' | 'pre-training' | 'deprecated'
   * @returns {object[]}
   */
  listByStatus(status) {
    return Object.values(this.skills).filter((s) => s.status === status);
  },

  /**
   * Validate registry structure — used by CI workflow
   * @returns {boolean}
   */
  validate() {
    const required = ['id', 'name', 'version', 'status', 'description'];
    for (const [key, skill] of Object.entries(this.skills)) {
      for (const field of required) {
        if (!skill[field]) {
          throw new Error(`Skill '${key}' missing required field: ${field}`);
        }
      }
    }
    return true;
  },
};

// CI validation on import
SKILL_REGISTRY.validate();

module.exports = SKILL_REGISTRY;
