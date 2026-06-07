import fetch from "node-fetch";

const MCP_URL = process.env.MCP_API_URL;

async function runMCPLifecycleTest() {
  console.log("🧠 Starting MCP Lifecycle Test...");

  const res = await fetch(`${MCP_URL}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: "Explain Hausa NLP and Machine Learning relationship"
    })
  });

  const data = await res.json();

  // 1. Must return response
  if (!data) throw new Error("❌ No response from MCP");

  // 2. Must include graph context
  if (!data.nodes || !data.edges) {
    throw new Error("❌ Missing graph context in MCP response");
  }

  // 3. Must include ranked output
  if (!data.ranked_insights) {
    throw new Error("❌ Missing ranking layer output");
  }

  console.log("✅ MCP LIFECYCLE VALID");
}

runMCPLifecycleTest();
