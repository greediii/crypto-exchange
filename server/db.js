const Database = require('better-sqlite3');
const path = require('path');

// Create/connect to SQLite database
const db = new Database(path.join(__dirname, 'database.sqlite'), {
  verbose: console.log
});

// Initialize database with tables
function initializeDatabase() {
  const createTables = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      total_exchanged DECIMAL(15,2) DEFAULT 0,
      cashapp_username TEXT,
      preferred_crypto TEXT DEFAULT 'BTC',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount_usd DECIMAL(15,2) NOT NULL,
      amount_crypto DECIMAL(20,8) NOT NULL,
      crypto_type TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      exchange_rate DECIMAL(15,2) NOT NULL,
      transaction_id TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      fee_percentage DECIMAL(5,2) NOT NULL,
      fee_amount DECIMAL(15,2) NOT NULL,
      tx_hash TEXT,
      error_details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

    CREATE TABLE IF NOT EXISTS wallet_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      crypto_type TEXT NOT NULL,
      address TEXT NOT NULL,
      label TEXT,
      is_default BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE user_crypto_stats (
      user_id INTEGER REFERENCES users(id),
      crypto_type VARCHAR(10),
      transaction_count INTEGER DEFAULT 0,
      total_amount_usd DECIMAL(15,2) DEFAULT 0,
      total_amount_crypto DECIMAL(20,8) DEFAULT 0,
      PRIMARY KEY (user_id, crypto_type)
    );

    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id)
    );

    DROP TABLE IF EXISTS fee_rules;
    CREATE TABLE fee_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crypto_type TEXT NOT NULL,
      price_range_start DECIMAL(10,2) NOT NULL,
      price_range_end DECIMAL(10,2) NOT NULL,
      fee_percentage DECIMAL(5,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CHECK (price_range_start < price_range_end)
    );

    CREATE INDEX IF NOT EXISTS idx_fee_rules_crypto_range ON fee_rules(crypto_type, price_range_start, price_range_end);

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ticket_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_ticket_responses_ticket_id ON ticket_responses(ticket_id);
  `;

  try {
    db.exec(createTables);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }

  // Insert default settings if they don't exist
  db.prepare(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES 
      ('feePercentage', '22'),
      ('cashappUsername', ''),
      ('exchangeEnabled', 'true')
  `).run();
}

initializeDatabase();

module.exports = db;