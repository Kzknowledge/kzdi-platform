import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function approveAgent(id: string) {
  return supabase
    .from("evolution_registry")
    .update({ status: "approved" })
    .eq("id", id);
}

export async function rejectAgent(id: string) {
  return supabase
    .from("evolution_registry")
    .update({ status: "rejected" })
    .eq("id", id);
}
