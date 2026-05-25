/**
 * KZDI Deployment Verification Script
 * Runs post-deployment to validate Supabase integration
 */

const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function verify() {
  console.log('🧪 Starting deployment verification...\n');

  try {
    // Test 1: API connectivity
    console.log('1️⃣  Testing Supabase API connectivity...');
    const healthCheck = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    });

    if (!healthCheck.ok) {
      throw new Error(`API returned ${healthCheck.status}`);
    }
    console.log('   ✅ Supabase API reachable\n');

    // Test 2: Agent registry accessible
    console.log('2️⃣  Checking agent_registry table...');
    const agentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/agent_registry?select=id,name,status`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
      }
    );

    if (!agentRes.ok) {
      throw new Error(`Agent registry check failed: ${agentRes.status}`);
    }
    const agents = await agentRes.json();
    console.log(`   ✅ Agent registry accessible (${agents.length} agents found)\n`);

    // Test 3: Telemetry events table accessible
    console.log('3️⃣  Checking telemetry_events table...');
    const telemetryRes = await fetch(
      `${SUPABASE_URL}/rest/v1/telemetry_events?limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
      }
    );

    if (!telemetryRes.ok) {
      throw new Error(`Telemetry check failed: ${telemetryRes.status}`);
    }
    console.log('   ✅ Telemetry events table accessible\n');

    // Test 4: Skill mastery table accessible
    console.log('4️⃣  Checking skill_mastery table...');
    const skillRes = await fetch(
      `${SUPABASE_URL}/rest/v1/skill_mastery?limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
      }
    );

    if (!skillRes.ok) {
      throw new Error(`Skill mastery check failed: ${skillRes.status}`);
    }
    console.log('   ✅ Skill mastery table accessible\n');

    // Test 5: System memory accessible
    console.log('5️⃣  Checking system_memory table...');
    const memoryRes = await fetch(
      `${SUPABASE_URL}/rest/v1/system_memory?limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
      }
    );

    if (!memoryRes.ok) {
      throw new Error(`System memory check failed: ${memoryRes.status}`);
    }
    console.log('   ✅ System memory table accessible\n');

    console.log('═══════════════════════════════════════');
    console.log('✅ ALL VERIFICATION CHECKS PASSED');
    console.log('═══════════════════════════════════════\n');
    console.log('Deployment Status: STABLE ✓');
    console.log('Ready for production use.\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Verify SUPABASE_URL and SUPABASE_ANON_KEY in GitHub Secrets');
    console.error('2. Check Supabase project status in dashboard');
    console.error('3. Ensure migration deployed successfully');
    console.log('\n');
    process.exit(1);
  }
}

verify();
