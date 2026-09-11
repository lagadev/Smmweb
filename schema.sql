-- SMM API Center — v9 schema (full website: auth + UglyPay payment gateway)

DROP TABLE IF EXISTS deposit_requests;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS platforms;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS settings;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  api_token TEXT,
  balance REAL NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user',
  banned INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_token ON users(api_token);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_token ON sessions(token);

CREATE TABLE platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'fa-solid fa-star',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_id INTEGER NOT NULL REFERENCES platforms(id),
  name TEXT NOT NULL,
  icon TEXT,
  tag TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX idx_categories_platform ON categories(platform_id);

CREATE TABLE services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id INTEGER UNIQUE NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  cost_rate REAL,
  markup_percent REAL,
  rate REAL NOT NULL,
  min_qty INTEGER NOT NULL DEFAULT 100,
  max_qty INTEGER NOT NULL DEFAULT 10000,
  description TEXT,
  avg_time TEXT,
  link_type TEXT,
  start_type TEXT,
  speed_info TEXT,
  refill_days INTEGER NOT NULL DEFAULT 0,
  provider_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_services_category ON services(category_id);
CREATE INDEX idx_services_public_id ON services(public_id);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  service_id INTEGER,
  service_public_id INTEGER,
  service_name TEXT,
  category_name TEXT,
  platform_name TEXT,
  link TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  charge REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  source TEXT NOT NULL DEFAULT 'app',
  refill_available INTEGER NOT NULL DEFAULT 0,
  refill_id TEXT,
  refill_status TEXT,
  provider_order_id TEXT,
  provider_error TEXT,
  start_count INTEGER,
  remains INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_transactions_user ON transactions(user_id);

CREATE TABLE deposit_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  reference_code TEXT UNIQUE NOT NULL,
  provider_invoice_id TEXT,
  pay_url TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_deposits_user ON deposit_requests(user_id);
CREATE INDEX idx_deposits_status ON deposit_requests(status);
CREATE INDEX idx_deposits_reference ON deposit_requests(reference_code);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT INTO settings (key, value) VALUES
  ('site_name', 'SMM API Center'),
  ('site_tagline', 'The fastest way to grow every social profile you manage'),
  ('currency', 'BDT'),
  ('currency_symbol', '৳'),
  ('support_link', ''),
  ('channel_link', ''),
  ('default_markup_percent', '50'),
  ('deposit_quick_amounts', '500,1000,2000,5000,10000'),
  ('provider_auto_order', '0'),
  ('provider_api_url', ''),
  ('provider_api_key', ''),
  ('payment_api_url', 'https://uglypay.devugly.workers.dev/api/invoices'),
  ('payment_api_key', '');

-- Starter platforms
INSERT INTO platforms (name, icon, sort_order) VALUES
  ('TikTok', 'fa-brands fa-tiktok', 1),
  ('Instagram', 'fa-brands fa-instagram', 2),
  ('Facebook', 'fa-brands fa-facebook', 3),
  ('YouTube', 'fa-brands fa-youtube', 4),
  ('Telegram', 'fa-brands fa-telegram', 5),
  ('Twitter / X', 'fa-brands fa-x-twitter', 6),
  ('Spotify', 'fa-brands fa-spotify', 7),
  ('Discord', 'fa-brands fa-discord', 8),
  ('LinkedIn', 'fa-brands fa-linkedin', 9),
  ('Other', 'fa-solid fa-globe', 10);

-- Seed admin account — username: admin / password: admin123 (CHANGE THIS after first login)
-- password_hash/password_salt below are PBKDF2-SHA256 (100000 iterations) for "admin123"
INSERT INTO users (username, name, email, password_hash, password_salt, role, verified)
VALUES (
  'admin', 'Administrator', 'admin@example.com',
  '4666e5962c22a221dc89bafcf38102d34ba599ddc25267143b049a320da79433',
  '0102030405060708090a0b0c0d0e0f10',
  'admin', 1
);
