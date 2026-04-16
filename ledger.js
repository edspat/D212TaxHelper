/**
 * Ledger Module - Persistent financial entry tracking
 * 
 * Stores all financial entries (vests, ESPP purchases, sales) with
 * FIFO cost basis and BIK allocation tracking.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

function uuid() {
  return crypto.randomUUID();
}

function load() {
  return db.loadLedger();
}

function save(ledger) {
  db.saveLedger(ledger);
}

/**
 * Parse date from stock award format
 * Supports: DD-Mon-YY, DD-Mon-YYYY, DD.MM.YYYY
 * Returns { year, sortKey } for ordering
 */
function parseVestDate(dateStr) {
  const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
  // Try DD-Mon-YY or DD-Mon-YYYY first
  let m = String(dateStr).match(/(\d{1,2})-(\w{3})-(\d{2,4})/);
  if (m) {
    let yr = parseInt(m[3]);
    if (yr < 100) yr += 2000;
    const mon = months[m[2].toLowerCase()] || 0;
    const day = parseInt(m[1]);
    return { year: yr, sortKey: new Date(yr, mon, day).getTime() };
  }
  // Try DD.MM.YYYY
  m = String(dateStr).match(/(\d{1,2})\.(\d{2})\.(\d{4})/);
  if (m) {
    const yr = parseInt(m[3]);
    const mon = parseInt(m[2]) - 1;
    const day = parseInt(m[1]);
    return { year: yr, sortKey: new Date(yr, mon, day).getTime() };
  }
  return { year: 0, sortKey: 0 };
}

/**
 * Parse date from trade confirmation format (MON/DD/YYYY)
 * Returns { year, sortKey }
 */
function parseSaleDate(dateStr) {
  const months = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };
  const m = String(dateStr).match(/(\w{3})\/(\d{2})\/(\d{4})/);
  if (!m) return { year: 0, sortKey: 0 };
  const yr = parseInt(m[3]);
  const mon = months[m[1].toUpperCase()] || 0;
  const day = parseInt(m[2]);
  return { year: yr, sortKey: new Date(yr, mon, day).getTime() };
}

// ============ ADD ENTRIES ============

/**
 * Add stock award vest entries from a parsed stock award document.
 * Deduplicates by (date + bikRON + withholdingRON).
 * @param {Array} rows - Parsed stock_award rows [{datastat, stock_award_bik, espp_gain_bik, stock_withholding}]
 * @param {string} sourceFile - Raw filename for source tracking
 * @returns {{ added: number, skipped: number }}
 */
function addVestEntries(rows, sourceFile) {
  const ledger = load();
  let added = 0, skipped = 0;

  for (const row of rows) {
    const bikRON = parseFloat(row.stock_award_bik) || 0;
    const esppBikRON = parseFloat(row.espp_gain_bik) || 0;
    const whRON = parseFloat(row.stock_withholding) || 0;
    const totalBik = bikRON + esppBikRON;

    // Skip rows with no financial data
    if (totalBik === 0 && whRON === 0) continue;

    const dateStr = row.datastat || '';
    const { year, sortKey } = parseVestDate(dateStr);

    // Dedup: check for existing entry with same date + amounts
    const isDup = ledger.entries.some(e =>
      e.type === 'stock_vest' && !e.deleted &&
      e.data.date === dateStr &&
      Math.abs((e.data.bikRON || 0) - totalBik) < 0.01 &&
      Math.abs((e.data.withholdingRON || 0) - whRON) < 0.01
    );

    if (isDup) { skipped++; continue; }

    const entry = {
      id: uuid(),
      type: 'stock_vest',
      year,
      sortKey,
      source: 'stock_award',
      sourceFile,
      data: {
        date: dateStr,
        bikRON: totalBik,
        stockAwardBikRON: bikRON,
        esppGainBikRON: esppBikRON,
        withholdingRON: whRON
      },
      deleted: false
    };

    ledger.entries.push(entry);
    added++;

    // Track source file
    if (!ledger.sourceFiles[sourceFile]) ledger.sourceFiles[sourceFile] = [];
    ledger.sourceFiles[sourceFile].push(entry.id);
  }

  if (added > 0) {
    recalculateAllocations(ledger);
    save(ledger);
  }

  return { added, skipped };
}

/**
 * Add a trade (sale or ESPP purchase) from a parsed trade confirmation.
 * Deduplicates by refNumber.
 * @param {Object} trade - Parsed trade object
 * @param {string} sourceFile - Raw filename for source tracking
 * @returns {{ added: boolean, isDuplicate: boolean }}
 */
function addTrade(trade, sourceFile) {
  const ledger = load();

  const type = trade.transactionType === 'purchase' ? 'espp_purchase' : 'sale';
  const dateStr = trade.saleDate || '';
  const parsed = type === 'espp_purchase'
    ? parseVestDate(dateStr.replace(/\//g, '-'))
    : parseSaleDate(dateStr);

  // Dedup by refNumber
  if (trade.refNumber) {
    const isDup = ledger.entries.some(e =>
      (e.type === 'sale' || e.type === 'espp_purchase') && !e.deleted &&
      e.data.refNumber === trade.refNumber
    );
    if (isDup) return { added: false, isDuplicate: true };
  }

  const entry = {
    id: uuid(),
    type,
    year: trade.year,
    sortKey: parsed.sortKey || Date.now(),
    source: trade.source || 'trade_confirmation',
    sourceFile,
    data: {
      date: dateStr,
      refNumber: trade.refNumber || '',
      symbol: trade.symbol || 'MSFT',
      shares: trade.shares || 0,
      pricePerShareUSD: trade.pricePerShare || 0,
      ...(type === 'sale' ? {
        saleProceedsUSD: trade.saleProceeds || 0,
        feesUSD: trade.fees || 0,
        netProceedsUSD: trade.netProceeds || 0,
      } : {
        marketValueUSD: trade.marketValue || 0,
        accumulatedContributionsUSD: trade.accumulatedContributions || 0,
        esppGainUSD: trade.esppGain || 0,
        purchaseCostUSD: trade.purchaseCost || 0,
        offeringPeriod: trade.offeringPeriod || '',
      })
    },
    deleted: false
  };

  ledger.entries.push(entry);

  if (!ledger.sourceFiles[sourceFile]) ledger.sourceFiles[sourceFile] = [];
  ledger.sourceFiles[sourceFile].push(entry.id);

  recalculateAllocations(ledger);
  save(ledger);

  return { added: true, isDuplicate: false };
}

/**
 * Add MS Statement trades (sales from Morgan Stanley).
 */
function addMSTrades(sales, sourceFile) {
  const ledger = load();
  let added = 0, skipped = 0;

  for (const sale of sales) {
    const dateStr = sale.saleDate || '';
    const parsed = parseSaleDate(dateStr);

    // Dedup by date + shares + netProceeds
    const isDup = ledger.entries.some(e =>
      e.type === 'sale' && !e.deleted &&
      e.data.date === dateStr &&
      Math.abs((e.data.shares || 0) - (sale.shares || 0)) < 0.001 &&
      Math.abs((e.data.netProceedsUSD || 0) - (sale.netProceeds || 0)) < 0.01
    );

    if (isDup) { skipped++; continue; }

    const entry = {
      id: uuid(),
      type: 'sale',
      year: sale.year,
      sortKey: parsed.sortKey || Date.now(),
      source: 'ms_statement',
      sourceFile,
      data: {
        date: dateStr,
        refNumber: sale.refNumber || '',
        symbol: sale.symbol || 'MSFT',
        shares: sale.shares || 0,
        pricePerShareUSD: sale.pricePerShare || 0,
        saleProceedsUSD: sale.saleProceeds || 0,
        feesUSD: sale.fees || 0,
        netProceedsUSD: sale.netProceeds || 0,
      },
      deleted: false
    };

    ledger.entries.push(entry);
    added++;

    if (!ledger.sourceFiles[sourceFile]) ledger.sourceFiles[sourceFile] = [];
    ledger.sourceFiles[sourceFile].push(entry.id);
  }

  if (added > 0) {
    recalculateAllocations(ledger);
    save(ledger);
  }

  return { added, skipped };
}

// ============ FIFO ALLOCATION ENGINE ============

/**
 * Recalculate all cost basis and BIK allocations across all years.
 * Uses FIFO: oldest vest lots / ESPP lots consumed first.
 */
function recalculateAllocations(ledger) {
  // Gather all active entries
  const vests = ledger.entries
    .filter(e => e.type === 'stock_vest' && !e.deleted)
    .sort((a, b) => a.sortKey - b.sortKey);

  const esppPurchases = ledger.entries
    .filter(e => e.type === 'espp_purchase' && !e.deleted)
    .sort((a, b) => a.sortKey - b.sortKey);

  const sales = ledger.entries
    .filter(e => e.type === 'sale' && !e.deleted)
    .sort((a, b) => a.sortKey - b.sortKey);

  // Build ESPP lot pool: each ESPP purchase is a lot with shares + cost
  const esppPool = esppPurchases.map(e => ({
    id: e.id,
    year: e.year,
    shares: e.data.shares,
    costPerShareUSD: e.data.shares > 0 ? e.data.accumulatedContributionsUSD / e.data.shares : 0,
    totalCostUSD: e.data.accumulatedContributionsUSD || 0,
    remaining: e.data.shares
  }));

  // Build BIK pool: each vest entry has a BIK amount (RON) - no share count
  const bikPool = vests.map(e => ({
    id: e.id,
    year: e.year,
    sortKey: e.sortKey,
    bikRON: e.data.bikRON || 0,
    remaining: e.data.bikRON || 0
  }));

  // Allocations per year
  const allocations = {};

  // FIFO: for each sale (chronological), consume from pools
  for (const sale of sales) {
    const yr = sale.year;
    if (!allocations[yr]) {
      allocations[yr] = {
        esppCostUSD: 0,
        esppSharesConsumed: 0,
        bikAllocatedRON: 0,
        salesCount: 0,
        salesNetUSD: 0,
        salesProceedsUSD: 0,
        salesFeesUSD: 0,
        salesShares: 0,
        purchasesCount: 0,
        purchasesContributionsUSD: 0,
        purchasesGainUSD: 0,
        purchasesShares: 0
      };
    }

    const alloc = allocations[yr];
    alloc.salesCount++;
    alloc.salesNetUSD += sale.data.netProceedsUSD || 0;
    alloc.salesProceedsUSD += sale.data.saleProceedsUSD || 0;
    alloc.salesFeesUSD += sale.data.feesUSD || 0;
    alloc.salesShares += sale.data.shares || 0;

    const sharesToAllocate = sale.data.shares || 0;

    // 1. FIFO consume ESPP lots (by shares)
    let sharesRemaining = sharesToAllocate;
    for (const lot of esppPool) {
      if (lot.remaining <= 0 || sharesRemaining <= 0) continue;
      const matched = Math.min(sharesRemaining, lot.remaining);
      lot.remaining -= matched;
      sharesRemaining -= matched;
      alloc.esppCostUSD += matched * lot.costPerShareUSD;
      alloc.esppSharesConsumed += matched;
    }

    // 2. FIFO consume BIK pool (proportional by shares sold vs total available)
    // Each BIK entry represents income taxed as salary for shares that vested.
    // We allocate BIK proportionally: for each vest up to the sale date,
    // consume the BIK amount if shares from that vest period are being sold.
    // Simple approach: consume BIK entries chronologically up to sale date.
    for (const bik of bikPool) {
      if (bik.remaining <= 0) continue;
      if (bik.sortKey > sale.sortKey) break; // Only consume BIK from before the sale
      const consumed = bik.remaining;
      bik.remaining = 0;
      alloc.bikAllocatedRON += consumed;
    }
  }

  // Also track ESPP purchases per year
  for (const purch of esppPurchases) {
    const yr = purch.year;
    if (!allocations[yr]) {
      allocations[yr] = {
        esppCostUSD: 0, esppSharesConsumed: 0, bikAllocatedRON: 0,
        salesCount: 0, salesNetUSD: 0, salesProceedsUSD: 0, salesFeesUSD: 0, salesShares: 0,
        purchasesCount: 0, purchasesContributionsUSD: 0, purchasesGainUSD: 0, purchasesShares: 0
      };
    }
    allocations[yr].purchasesCount++;
    allocations[yr].purchasesContributionsUSD += purch.data.accumulatedContributionsUSD || 0;
    allocations[yr].purchasesGainUSD += purch.data.esppGainUSD || 0;
    allocations[yr].purchasesShares += purch.data.shares || 0;
  }

  // Round all USD values to 2 decimals, RON to integers
  for (const yr of Object.keys(allocations)) {
    const a = allocations[yr];
    a.esppCostUSD = parseFloat(a.esppCostUSD.toFixed(2));
    a.bikAllocatedRON = Math.round(a.bikAllocatedRON);
    a.salesNetUSD = parseFloat(a.salesNetUSD.toFixed(2));
    a.salesProceedsUSD = parseFloat(a.salesProceedsUSD.toFixed(2));
    a.salesFeesUSD = parseFloat(a.salesFeesUSD.toFixed(2));
    a.salesShares = parseFloat(a.salesShares.toFixed(6));
    a.purchasesContributionsUSD = parseFloat(a.purchasesContributionsUSD.toFixed(2));
    a.purchasesGainUSD = parseFloat(a.purchasesGainUSD.toFixed(2));
  }

  ledger.allocations = allocations;
}

// ============ SOFT DELETE ============

/**
 * Soft-delete all entries from a source file and recalculate.
 * @param {string} sourceFile - The raw filename being purged
 */
function purgeBySourceFile(sourceFile) {
  const ledger = load();
  const ids = ledger.sourceFiles[sourceFile] || [];
  let deleted = 0;

  for (const entry of ledger.entries) {
    if (ids.includes(entry.id) && !entry.deleted) {
      entry.deleted = true;
      deleted++;
    }
  }

  delete ledger.sourceFiles[sourceFile];

  if (deleted > 0) {
    recalculateAllocations(ledger);
    save(ledger);
  }

  return { deleted };
}

/**
 * Purge all vest entries for a specific year.
 */
function purgeVestsByYear(year) {
  const ledger = load();
  let deleted = 0;

  for (const entry of ledger.entries) {
    if (entry.type === 'stock_vest' && !entry.deleted && entry.year === year) {
      entry.deleted = true;
      deleted++;
    }
  }

  if (deleted > 0) {
    recalculateAllocations(ledger);
    save(ledger);
  }

  return { deleted };
}

// ============ QUERIES ============

/**
 * Get allocations for a specific year.
 */
function getAllocations(year) {
  const ledger = load();
  return ledger.allocations[year] || {
    esppCostUSD: 0, esppSharesConsumed: 0, bikAllocatedRON: 0,
    salesCount: 0, salesNetUSD: 0, salesProceedsUSD: 0, salesFeesUSD: 0, salesShares: 0,
    purchasesCount: 0, purchasesContributionsUSD: 0, purchasesGainUSD: 0, purchasesShares: 0
  };
}

/**
 * Get all allocations for all years.
 */
function getAllAllocations() {
  const ledger = load();
  return ledger.allocations || {};
}

/**
 * Get summary of all ledger entries (for debugging/display).
 */
function getSummary() {
  const ledger = load();
  const active = ledger.entries.filter(e => !e.deleted);
  return {
    totalEntries: ledger.entries.length,
    activeEntries: active.length,
    vests: active.filter(e => e.type === 'stock_vest').length,
    esppPurchases: active.filter(e => e.type === 'espp_purchase').length,
    sales: active.filter(e => e.type === 'sale').length,
    allocations: ledger.allocations,
    sourceFiles: Object.keys(ledger.sourceFiles).length
  };
}

/**
 * Get all active entries of a given type, optionally filtered by year.
 */
function getEntries(type, year) {
  const ledger = load();
  return ledger.entries.filter(e =>
    e.type === type && !e.deleted &&
    (year == null || e.year === year)
  ).sort((a, b) => a.sortKey - b.sortKey);
}

// ============ MIGRATION ============

/**
 * Migrate from existing trades.json + stock_awards.json into ledger.
 * Only adds entries not already in the ledger (idempotent).
 */
function migrateFromExisting(dataDir) {
  const tradesFile = path.join(dataDir, 'trades.json');
  const stockFile = path.join(dataDir, 'stock_awards.json');
  let migrated = { trades: 0, vests: 0, skipped: 0 };

  // Migrate trades
  if (fs.existsSync(tradesFile)) {
    const tj = JSON.parse(fs.readFileSync(tradesFile, 'utf8'));
    for (const trade of (tj.trades || [])) {
      const sourceFile = `trade_confirmation_${trade.year}_raw.txt`;
      if (trade.transactionType === 'purchase') {
        const result = addTrade(trade, sourceFile);
        if (result.added) migrated.trades++;
        else migrated.skipped++;
      } else {
        const result = addTrade(trade, trade.source === 'ms_statement' ? `ms_statement_${trade.year}_raw.txt` : sourceFile);
        if (result.added) migrated.trades++;
        else migrated.skipped++;
      }
    }
  }

  // Migrate stock awards
  if (fs.existsSync(stockFile)) {
    const sa = JSON.parse(fs.readFileSync(stockFile, 'utf8'));
    const rows = sa['Stock Awards'] || [];
    if (rows.length > 0) {
      const result = addVestEntries(rows, 'stock_award_migrated_raw.txt');
      migrated.vests = result.added;
      migrated.skipped += result.skipped;
    }
  }

  return migrated;
}

module.exports = {
  load,
  save,
  addVestEntries,
  addTrade,
  addMSTrades,
  recalculateAllocations,
  purgeBySourceFile,
  purgeVestsByYear,
  getAllocations,
  getAllAllocations,
  getSummary,
  getEntries,
  migrateFromExisting
};
