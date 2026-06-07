async function systemHealthCheck() {
  console.log("🧠 Running System Health Check...");

  const checks = [
    fetch(`${process.env.MCP_API_URL}/health`).then(r => r.ok),
  ];

  const results = await Promise.all(checks);

  if (results.includes(false)) {
    throw new Error("❌ System health failure");
  }

  console.log("✅ SYSTEM HEALTH OK");
}

systemHealthCheck();
