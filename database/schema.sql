CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  payment_reference TEXT NOT NULL UNIQUE,
  preference_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'expired', 'cancelled', 'checkout_failed', 'payment_review')),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  service_type TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  sessions INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  schedules_json TEXT NOT NULL,
  hold_expires_at TEXT,
  paid_at TEXT,
  email_sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Cada linha representa um bloco indivisivel de 15 minutos.
-- A chave primaria impede duas reservas no mesmo bloco.
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
