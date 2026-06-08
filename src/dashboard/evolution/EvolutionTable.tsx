import { approveAgent, rejectAgent } from "./actions";

export function EvolutionTable({ agents }: { agents: any[] }) {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">🧬 Evolution Registry</h2>

      <table className="w-full mt-4 border">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Parent</th>
            <th>Type</th>
            <th>Status</th>
            <th>Expected Bias</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {agents.map((a) => (
            <tr key={a.id}>
              <td>{a.new_agent_id}</td>
              <td>{a.parent}</td>
              <td>{a.mutation_type}</td>
              <td>{a.status}</td>
              <td>{a.expected_bias}</td>

              <td className="flex gap-2">
                <button
                  onClick={() => approveAgent(a.id)}
                  style={{ color: "green" }}
                >
                  Approve
                </button>

                <button
                  onClick={() => rejectAgent(a.id)}
                  style={{ color: "red" }}
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
