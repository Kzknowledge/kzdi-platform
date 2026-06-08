import "dotenv/config";

import { emitEvent } from "../producers/eventProducer";
import "../core/rlEventEngine"; // registers handlers
import { runWorkerLoop } from "../distributed/queueWorker";

/**
 * 🚀 BOOT THE FULL RL SYSTEM
 */
async function start() {
  console.log("🚀 STARTING KZDI RL SYSTEM");

  console.log("📡 Event system loaded");
  console.log("⚔️ RL engine registered");
  console.log("🧠 Workers initializing");

  // Start worker in background
  runWorkerLoop();

  // Seed initial signal to activate system
  await emitEvent("reinforcement_trigger", {
    reason: "system_boot",
    bootstrap: true,
  });

  console.log("✅ SYSTEM FULLY ACTIVE");
}

start();
