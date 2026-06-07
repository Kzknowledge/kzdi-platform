"use client";

import { useEvolution } from "./useEvolution";
import { EvolutionTable } from "./EvolutionTable";

export default function EvolutionDashboard() {
  const { agents, loading } = useEvolution();

  if (loading) return <p>Loading evolution system...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold p-4">
        🧬 MCP Evolution Dashboard
      </h1>

      <EvolutionTable agents={agents} />
    </div>
  );
}
