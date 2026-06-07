import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function validateTelemetry() {
  console.log("📡 Checking telemetry...");

  const { data } = await supabase
    .from("telemetry_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (!data?.length) {
    throw new Error("❌ Telemetry not recording");
  }

  console.log("✅ TELEMETRY ACTIVE (Make.com optional for now)");
}

validateTelemetry();
