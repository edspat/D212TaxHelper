/**
 * Database Module - SQLite storage layer via better-sqlite3
 *
 * Replaces JSON file I/O with ACID-compliant SQLite transactions.
 * Provides high-level methods that mirror the existing data access patterns.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'd212tax.db');

let _db = null;

function getDb() {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  initSchema();
  return _db;
}

function close() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function initSchema() {
  _db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS year_data (
      year INTEGER PRIMARY KEY,
      data TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      ref_number TEXT,
      source TEXT,
      transaction_type TEXT,
      sale_date TEXT,
      shares REAL,
      net_proceeds REAL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_awards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      datastat TEXT,
      stock_award_bik REAL DEFAULT 0,
      espp_gain_bik REAL DEFAULT 0,
      stock_withholding REAL DEFAULT 0,
      dinit TEXT,
      sort_key REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      year INTEGER,
      sort_key REAL,
      source TEXT,
      source_file TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ledger_allocations (
      year INTEGER PRIMARY KEY,
      data TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS ledger_source_files (
      source_file TEXT NOT NULL,
      entry_id TEXT NOT NULL,
      PRIMARY KEY (source_file, entry_id)
    );

    INSERT OR IGNORE INTO schema_version (version) VALUES (1);
  `);
}

// ============ TRANSACTIONS ============

function transaction(fn) {
  const db = getDb();
  return db.transaction(fn)();
}

// ============ YEAR DATA (replaces parsed_data.json) ============

function getAllYears() {
  const db = getDb();
  const rows = db.prepare('SELECT year, data FROM year_data ORDER BY year').all();
  const years = {};
  for (const row of rows) {
    years[row.year] = JSON.parse(row.data);
  }
  return years;
}

function getYearData(year) {
  const db = getDb();
  const row = db.prepare('SELECT data FROM year_data WHERE year = ?').get(year);
  return row ? JSON.parse(row.data) : null;
}

function setYearData(year, data) {
  const db = getDb();
  data.year = year;
  db.prepare(
    'INSERT INTO year_data (year, data) VALUES (?, ?) ON CONFLICT(year) DO UPDATE SET data = excluded.data'
  ).run(year, JSON.stringify(data));
}

function mergeYearData(year, updates) {
  const db = getDb();
  let existing = getYearData(year) || { year };
  existing = { ...existing, ...updates, year };
  setYearData(year, existing);
  return existing;
}

function deleteYearField(year, field) {
  const data = getYearData(year);
  if (!data) return;
  delete data[field];
  if (Object.keys(data).filter(k => k !== 'year').length === 0) {
    deleteYear(year);
  } else {
    setYearData(year, data);
  }
}

function deleteYearFields(year, fields) {
  const data = getYearData(year);
  if (!data) return;
  for (const f of fields) {
    delete data[f];
  }
  if (Object.keys(data).filter(k => k !== 'year').length === 0) {
    deleteYear(year);
  } else {
    setYearData(year, data);
  }
}

function deleteYear(year) {
  const db = getDb();
  db.prepare('DELETE FROM year_data WHERE year = ?').run(year);
}

// ============ TRADES (replaces trades.json) ============

function getAllTrades() {
  const db = getDb();
  return db.prepare('SELECT data FROM trades ORDER BY year, id').all().map(r => JSON.parse(r.data));
}

function getTradesByYear(year) {
  const db = getDb();
  return db.prepare('SELECT data FROM trades WHERE year = ? ORDER BY id').all(year).map(r => JSON.parse(r.data));
}

function addTrade(trade) {
  const db = getDb();
  // Dedup by refNumber if present
  if (trade.refNumber) {
    const existing = db.prepare('SELECT id FROM trades WHERE ref_number = ?').get(trade.refNumber);
    if (existing) return false;
  }
  db.prepare(
    'INSERT INTO trades (year, ref_number, source, transaction_type, sale_date, shares, net_proceeds, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    trade.year,
    trade.refNumber || null,
    trade.source || null,
    trade.transactionType || null,
    trade.saleDate || null,
    trade.shares || 0,
    trade.netProceeds || 0,
    JSON.stringify(trade)
  );
  return true;
}

function addTradeIfNotDuplicate(trade) {
  const db = getDb();
  // Dedup by date + shares + netProceeds (for MS statement trades without refNumber)
  const existing = db.prepare(
    'SELECT id FROM trades WHERE sale_date = ? AND ABS(shares - ?) < 0.001 AND ABS(net_proceeds - ?) < 0.01'
  ).get(trade.saleDate || '', trade.shares || 0, trade.netProceeds || 0);
  if (existing) return false;
  return addTrade(trade);
}

function deleteTradesBySource(source) {
  const db = getDb();
  db.prepare('DELETE FROM trades WHERE source = ?').run(source);
}

function deleteTradesExceptSource(source) {
  const db = getDb();
  db.prepare('DELETE FROM trades WHERE source IS NULL OR source != ?').run(source);
}

function clearTrades() {
  const db = getDb();
  db.prepare('DELETE FROM trades').run();
}

// ============ STOCK AWARDS (replaces stock_awards.json) ============

function getAllStockAwards() {
  const db = getDb();
  return db.prepare('SELECT * FROM stock_awards ORDER BY sort_key, id').all().map(row => ({
    datastat: row.datastat,
    stock_award_bik: row.stock_award_bik,
    espp_gain_bik: row.espp_gain_bik,
    stock_withholding: row.stock_withholding,
    dinit: row.dinit,
  }));
}

function addStockAward(row) {
  const db = getDb();
  // Dedup by datastat + stock_withholding + stock_award_bik
  const existing = db.prepare(
    'SELECT id FROM stock_awards WHERE datastat = ? AND ABS(stock_withholding - ?) < 0.01 AND ABS(stock_award_bik - ?) < 0.01'
  ).get(row.datastat || '', row.stock_withholding || 0, row.stock_award_bik || 0);
  if (existing) return false;

  const sortKey = computeStockAwardSortKey(row.datastat);
  db.prepare(
    'INSERT INTO stock_awards (datastat, stock_award_bik, espp_gain_bik, stock_withholding, dinit, sort_key) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    row.datastat || null,
    parseFloat(row.stock_award_bik) || 0,
    parseFloat(row.espp_gain_bik) || 0,
    parseFloat(row.stock_withholding) || 0,
    row.dinit || null,
    sortKey
  );
  return true;
}

function clearStockAwards() {
  const db = getDb();
  db.prepare('DELETE FROM stock_awards').run();
}

function computeStockAwardSortKey(dateStr) {
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  let m = String(dateStr || '').match(/(\d{1,2})-(\w{3})-(\d{2,4})/);
  if (m) {
    let yr = parseInt(m[3]); if (yr < 100) yr += 2000;
    return new Date(yr, months[m[2].toLowerCase()] || 0, parseInt(m[1])).getTime();
  }
  m = String(dateStr || '').match(/(\d{1,2})\.(\d{2})\.(\d{4})/);
  if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])).getTime();
  return 0;
}

// ============ LEDGER (replaces ledger.json) ============

function loadLedger() {
  const db = getDb();
  const entries = db.prepare('SELECT * FROM ledger_entries ORDER BY sort_key').all().map(row => ({
    id: row.id,
    type: row.type,
    year: row.year,
    sortKey: row.sort_key,
    source: row.source,
    sourceFile: row.source_file,
    data: JSON.parse(row.data),
    deleted: !!row.deleted,
  }));

  const allocRows = db.prepare('SELECT year, data FROM ledger_allocations').all();
  const allocations = {};
  for (const row of allocRows) {
    allocations[row.year] = JSON.parse(row.data);
  }

  const sfRows = db.prepare('SELECT source_file, entry_id FROM ledger_source_files').all();
  const sourceFiles = {};
  for (const row of sfRows) {
    if (!sourceFiles[row.source_file]) sourceFiles[row.source_file] = [];
    sourceFiles[row.source_file].push(row.entry_id);
  }

  return { entries, allocations, sourceFiles };
}

function saveLedger(ledger) {
  const db = getDb();
  db.transaction(() => {
    // Clear and rewrite all ledger data atomically
    db.prepare('DELETE FROM ledger_entries').run();
    db.prepare('DELETE FROM ledger_allocations').run();
    db.prepare('DELETE FROM ledger_source_files').run();

    const insertEntry = db.prepare(
      'INSERT INTO ledger_entries (id, type, year, sort_key, source, source_file, data, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const e of ledger.entries) {
      insertEntry.run(e.id, e.type, e.year, e.sortKey, e.source, e.sourceFile, JSON.stringify(e.data), e.deleted ? 1 : 0);
    }

    const insertAlloc = db.prepare(
      'INSERT INTO ledger_allocations (year, data) VALUES (?, ?)'
    );
    for (const [yr, data] of Object.entries(ledger.allocations || {})) {
      insertAlloc.run(parseInt(yr), JSON.stringify(data));
    }

    const insertSf = db.prepare(
      'INSERT OR IGNORE INTO ledger_source_files (source_file, entry_id) VALUES (?, ?)'
    );
    for (const [sf, ids] of Object.entries(ledger.sourceFiles || {})) {
      for (const id of ids) {
        insertSf.run(sf, id);
      }
    }
  })();
}

// ============ MIGRATION FROM JSON FILES ============

function migrateFromJson(dataDir) {
  const db = getDb();
  let migrated = { parsedData: false, trades: 0, stockAwards: 0, ledger: false };

  db.transaction(() => {
    // 1. Migrate parsed_data.json → year_data table
    const parsedFile = path.join(dataDir, 'parsed_data.json');
    if (fs.existsSync(parsedFile)) {
      const data = JSON.parse(fs.readFileSync(parsedFile, 'utf8'));
      if (data.years) {
        const insert = db.prepare(
          'INSERT OR IGNORE INTO year_data (year, data) VALUES (?, ?)'
        );
        for (const [yr, yd] of Object.entries(data.years)) {
          insert.run(parseInt(yr), JSON.stringify(yd));
        }
        migrated.parsedData = true;
      }
    }

    // 2. Migrate trades.json → trades table
    const tradesFile = path.join(dataDir, 'trades.json');
    if (fs.existsSync(tradesFile)) {
      const raw = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
      const trades = Array.isArray(raw.trades) ? raw.trades : [];
      const insert = db.prepare(
        'INSERT INTO trades (year, ref_number, source, transaction_type, sale_date, shares, net_proceeds, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const t of trades) {
        insert.run(
          t.year, t.refNumber || null, t.source || null,
          t.transactionType || null, t.saleDate || null,
          t.shares || 0, t.netProceeds || 0, JSON.stringify(t)
        );
        migrated.trades++;
      }
    }

    // 3. Migrate stock_awards.json → stock_awards table
    const stockFile = path.join(dataDir, 'stock_awards.json');
    if (fs.existsSync(stockFile)) {
      const sa = JSON.parse(fs.readFileSync(stockFile, 'utf8'));
      const rows = sa['Stock Awards'] || [];
      const insert = db.prepare(
        'INSERT INTO stock_awards (datastat, stock_award_bik, espp_gain_bik, stock_withholding, dinit, sort_key) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const r of rows) {
        insert.run(
          r.datastat || null,
          parseFloat(r.stock_award_bik) || 0,
          parseFloat(r.espp_gain_bik) || 0,
          parseFloat(r.stock_withholding) || 0,
          r.dinit || null,
          computeStockAwardSortKey(r.datastat)
        );
        migrated.stockAwards++;
      }
    }

    // 4. Migrate ledger.json → ledger tables
    const ledgerFile = path.join(dataDir, 'ledger.json');
    if (fs.existsSync(ledgerFile)) {
      const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
      saveLedgerDirect(db, ledger);
      migrated.ledger = true;
    }
  })();

  return migrated;
}

/** Internal: save ledger within an existing transaction context */
function saveLedgerDirect(db, ledger) {
  const insertEntry = db.prepare(
    'INSERT OR REPLACE INTO ledger_entries (id, type, year, sort_key, source, source_file, data, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const e of (ledger.entries || [])) {
    insertEntry.run(e.id, e.type, e.year, e.sortKey, e.source, e.sourceFile, JSON.stringify(e.data), e.deleted ? 1 : 0);
  }

  const insertAlloc = db.prepare(
    'INSERT OR REPLACE INTO ledger_allocations (year, data) VALUES (?, ?)'
  );
  for (const [yr, data] of Object.entries(ledger.allocations || {})) {
    insertAlloc.run(parseInt(yr), JSON.stringify(data));
  }

  const insertSf = db.prepare(
    'INSERT OR IGNORE INTO ledger_source_files (source_file, entry_id) VALUES (?, ?)'
  );
  for (const [sf, ids] of Object.entries(ledger.sourceFiles || {})) {
    for (const id of ids) {
      insertSf.run(sf, id);
    }
  }
}

/**
 * Check if JSON files exist and DB is empty — if so, migrate.
 * Returns migration result or null if no migration needed.
 */
function autoMigrate(dataDir) {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM year_data').get().c
    + db.prepare('SELECT COUNT(*) as c FROM trades').get().c
    + db.prepare('SELECT COUNT(*) as c FROM stock_awards').get().c
    + db.prepare('SELECT COUNT(*) as c FROM ledger_entries').get().c;

  if (count > 0) return null; // DB already has data

  // Check if any JSON files exist to migrate
  const jsonFiles = ['parsed_data.json', 'trades.json', 'stock_awards.json', 'ledger.json'];
  const hasJson = jsonFiles.some(f => {
    const fp = path.join(dataDir, f);
    if (!fs.existsSync(fp)) return false;
    try {
      const content = fs.readFileSync(fp, 'utf8').trim();
      // Check if file has actual data (not just empty skeleton)
      const parsed = JSON.parse(content);
      if (f === 'parsed_data.json') return parsed.years && Object.keys(parsed.years).length > 0;
      if (f === 'trades.json') return Array.isArray(parsed.trades) && parsed.trades.length > 0;
      if (f === 'stock_awards.json') return Array.isArray(parsed['Stock Awards']) && parsed['Stock Awards'].length > 0;
      if (f === 'ledger.json') return Array.isArray(parsed.entries) && parsed.entries.length > 0;
      return false;
    } catch { return false; }
  });

  if (!hasJson) return null;

  return migrateFromJson(dataDir);
}

module.exports = {
  getDb,
  close,
  transaction,
  // Year data
  getAllYears,
  getYearData,
  setYearData,
  mergeYearData,
  deleteYearField,
  deleteYearFields,
  deleteYear,
  // Trades
  getAllTrades,
  getTradesByYear,
  addTrade,
  addTradeIfNotDuplicate,
  deleteTradesBySource,
  deleteTradesExceptSource,
  clearTrades,
  // Stock awards
  getAllStockAwards,
  addStockAward,
  clearStockAwards,
  // Ledger
  loadLedger,
  saveLedger,
  // Migration
  autoMigrate,
  migrateFromJson,
};
