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

/**
 * CONFIG (tuned for cost + stability)
 */
const BATCH_SIZE = 10;
const MAX_RETRIES = 3;
const RATE_LIMIT_DELAY = 250;

/**
 * Build MCP embedding text (stable + deterministic)
 */
function buildText(node: any): string {
  return [
    node.title,
    node.summary,
    node.category,
    Array.isArray(node.tags) ? node.tags.join(",") : "",
    node.node_type,
    node.title_hausa,
    node.summary_hausa,
  ]
    .filter(Boolean)
    .join(" | ")
    .trim();
}

/**
 * Retry-safe embedding generator (only retries transient failures)
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
    } catch (err: any) {
      lastError = err;

      const isRateLimit =
        err?.status === 429 || err?.code === "rate_limit_exceeded";

      const isRetryable = isRateLimit || err?.status >= 500;

      if (!isRetryable) {
        console.error("❌ Non-retryable embedding error:", err.message);
        throw err;
      }

      console.warn(
        `⚠️ Retry ${attempt}/${MAX_RETRIES} (reason: ${err.message})`
      );

      await sleep(500 * attempt);
    }
  }

  throw lastError;
}

/**
 * Fetch nodes WITHOUT embeddings (resume-safe)
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
 * Safe partial update (prevents accidental overwrite issues)
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
 * Main pipeline (resilient loop)
 */
async function run() {
  console.log("🚀 MCP Embedding Pipeline STARTED");

  let totalProcessed = 0;
  let batchCount = 0;

  while (true) {
    const nodes = await fetchNodes();

    if (!nodes.length) {
      console.log("✅ ALL NODES EMBEDDED");
      break;
    }

    batchCount++;
    console.log(`📦 Batch ${batchCount}: ${nodes.length} nodes`);

    for (const node of nodes) {
      try {
        const text = buildText(node);

        if (!text) {
          console.warn(`⚠️ Skipping empty node: ${node.id}`);
          continue;
        }

        console.log(`🧠 Embedding: ${node.title}`);

        const embedding = await generateEmbedding(text);

        await updateNode(node.id, embedding);

        totalProcessed++;

        await sleep(RATE_LIMIT_DELAY);
      } catch (err: any) {
        console.error(`❌ Node failed (${node.id}):`, err.message);
        // continue pipeline (important for production resilience)
        continue;
      }
    }

    console.log(`📊 Progress: ${totalProcessed} nodes embedded`);
  }

  console.log(`🎉 DONE — Total embedded: ${totalProcessed}`);
}

run().catch((err) => {
  console.error("❌ PIPELINE FAILED:", err.message);
  process.exit(1);
});
