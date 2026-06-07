import { emit } from "./core/eventBus";
import "./core/rlEventEngine"; // registers handlers

/**
 * 🚀 SIMULATED TELEMETRY FEED
 * In production: replace with webhook / DB trigger / Kafka / Supabase realtime
 */
async function simulateTelemetry() {
  setInterval(async () => {
    await emit({
      type: "telemetry_event",
      data: { source: "system", value: Math.random() },
      timestamp: new Date().toISOString(),
    });
  }, 3000);
}

console.log("🚀 EVENT-DRIVEN RL SYSTEM STARTED");

simulateTelemetry();
