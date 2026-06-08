import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useEvolution() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    const { data, error } = await supabase
      .from("evolution_registry")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setAgents(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAgents();

    const channel = supabase
      .channel("evolution_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evolution_registry" },
        () => fetchAgents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { agents, loading, refresh: fetchAgents };
}
