BEGIN;

DROP POLICY IF EXISTS insert_events_policy 
  ON event_bus.events_y2026m05;

DROP POLICY IF EXISTS select_events_policy 
  ON event_bus.events_y2026m05;

CREATE POLICY insert_events_policy
  ON event_bus.events_y2026m05 FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY select_events_policy
  ON event_bus.events_y2026m05 FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

COMMIT;
