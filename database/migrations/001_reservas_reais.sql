-- Execute UMA vez no console D1 do banco elainne-agenda-test.
-- A tabela orders ja existe no MVP inicial.
ALTER TABLE orders ADD COLUMN hold_expires_at TEXT;
ALTER TABLE orders ADD COLUMN paid_at TEXT;
ALTER TABLE orders ADD COLUMN updated_at TEXT;

UPDATE orders SET updated_at = created_at WHERE updated_at IS NULL;

CREATE TABLE IF NOT EXISTS appointment_slots (
  slot_key TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('held', 'confirmed')),
  expires_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_appointment_slots_order ON appointment_slots(order_id);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_expiry ON appointment_slots(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_expiry ON orders(status, hold_expires_at);
