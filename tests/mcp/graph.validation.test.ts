import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function validateGraph() {
  console.log("📊 Validating Graph...");

  const { data: nodes } = await supabase
    .from("nodes")
    .select("*")
    .limit(10);

  const { data: edges } = await supabase
    .from("edges")
    .select("*")
    .limit(10);

  if (!nodes?.length) throw new Error("❌ No nodes found");
  if (!edges?.length) throw new Error("❌ No edges found");

  console.log("✅ GRAPH VALID");
}

validateGraph();
