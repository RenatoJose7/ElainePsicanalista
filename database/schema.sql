CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  payment_reference TEXT NOT NULL UNIQUE,
  preference_id TEXT,
  status TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  service_type TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  sessions INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  schedules_json TEXT NOT NULL,
  email_sent_at TEXT,
  created_at TEXT NOT NULL
);
