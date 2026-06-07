import { systemHealth } from "./health";
import { systemMetrics } from "./metrics";

export async function getSystemStatus() {
  const [health, metrics] = await Promise.all([
    systemHealth(),
    systemMetrics()
  ]);

  return {
    health,
    metrics
  };
}
