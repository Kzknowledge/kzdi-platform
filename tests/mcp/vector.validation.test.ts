async function validateVector() {
  console.log("🔎 Testing Vector Search...");

  const res = await fetch(`${process.env.MCP_API_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "machine learning"
    })
  });

  const data = await res.json();

  if (!data.nodes || data.nodes.length === 0) {
    throw new Error("❌ Vector retrieval failed");
  }

  console.log("✅ VECTOR SEARCH VALID");
}

validateVector();
