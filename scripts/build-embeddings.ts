import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const BATCH_SIZE = 10;
const MAX_RETRIES = 3;
const RATE_LIMIT_DELAY = 200; // ms between requests (cost + throttle control)

/**
 * Build MCP embedding text
 */
function buildText(node: any): string {
  return [
    node.title,
    node.summary,
    node.category,
    (node.tags || []).join(","),
    node.node_type,
    node.title_hausa,
    node.summary_hausa,
  ]
    .filter(Boolean)
    .join(" | ");
}

/**
 * Generate embedding with retry logic
 */
async function generateEmbedding(text: string): Promise<number[]> {
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });

      return res.data[0].embedding;
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Retry ${attempt}/${MAX_RETRIES} failed`);

      await new Promise((r) =>
        setTimeout(r, 500 * attempt) // exponential backoff
      );
    }
  }

  throw lastError;
}

/**
 * Fetch only nodes missing embeddings (CRITICAL OPTIMIZATION)
 */
async function fetchNodes() {
  const { data, error } = await supabase
    .from("nodes")
    .select(
      "id, title, summary, category, tags, node_type, title_hausa, summary_hausa"
    )
    .is("embedding", null)
    .limit(BATCH_SIZE);

  if (error) throw error;
  return data || [];
}

/**
 * Update node embedding
 */
async function updateNode(id: string, embedding: number[]) {
  const { error } = await supabase
    .from("nodes")
    .update({
      embedding,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Sleep helper (rate control)
 */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Main pipeline
 */
async function run() {
  console.log("🚀 MCP Embedding Pipeline STARTED");

  let totalProcessed = 0;

  while (true) {
    const nodes = await fetchNodes();

    if (nodes.length === 0) {
      console.log("✅ ALL NODES EMBEDDED");
      break;
    }

    console.log(`📦 Processing batch: ${nodes.length} nodes`);

    for (const node of nodes) {
      try {
        const text = buildText(node);

        console.log(`🧠 Embedding: ${node.title}`);

        const embedding = await generateEmbedding(text);

        await updateNode(node.id, embedding);

        totalProcessed++;

        // rate control (cost + API safety)
        await sleep(RATE_LIMIT_DELAY);
      } catch (err) {
        console.error(`❌ Failed node ${node.id}`, err);
      }
    }

    console.log(`📊 Progress: ${totalProcessed} nodes processed`);
  }

  console.log(`🎉 DONE — Total embedded: ${totalProcessed}`);
}

run().catch((err) => {
  console.error("❌ PIPELINE FAILED:", err);
  process.exit(1);
});
