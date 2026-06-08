type EventType =
  | "telemetry_event"
  | "competition_run"
  | "agent_evolution"
  | "reinforcement_trigger"
  | "lock_acquired"
  | "lock_failed";

type EventPayload = {
  type: EventType;
  data?: any;
  timestamp: string;
};

type Handler = (event: EventPayload) => Promise<void> | void;

const handlers: Record<string, Handler[]> = {};

/**
 * 📡 REGISTER HANDLER
 */
export function on(eventType: EventType, handler: Handler) {
  if (!handlers[eventType]) handlers[eventType] = [];
  handlers[eventType].push(handler);
}

/**
 * 📡 EMIT EVENT
 */
export async function emit(event: EventPayload) {
  const list = handlers[event.type] || [];

  console.log(`📡 EVENT: ${event.type}`);

  for (const handler of list) {
    try {
      await handler(event);
    } catch (err) {
      console.error(`❌ handler error`, err);
    }
  }
}
