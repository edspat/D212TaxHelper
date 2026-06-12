/**
 * Revolut Securities Europe UAB consolidated statement parser.
 *
 * Parses the annual "Consolidated statement" PDF that Revolut Securities
 * Europe UAB issues from the Invest tab → Documents → Annual Tax Report
 * (file naming: Revolut-extern-consolidated-statement_{YYYY-MM-DD}_*.pdf).
 *
 * Key fiscal context (Romania, 2025+):
 *   - Revolut Securities Europe UAB is a non-resident broker (Lithuania).
 *     For a Romanian fiscal resident this means capital gains are foreign-
 *     source income (D212 Cap. I §2.1, str_categ_venit = 2012), NOT
 *     Romanian-source via art. 96^1 reț. la sursă.
 *   - Revolut does NOT withhold tax at source on capital gains. The full
 *     gross gain is taxable in RO at the standard cap-gains rate, with
 *     foreign tax credit = 0 (nothing was paid abroad).
 *   - Revolut DOES withhold US dividend tax at source on US-listed
 *     securities via the W8-BEN treaty rate (10% for RO). EU dividends
 *     vary by source jurisdiction. The statement separates these.
 *
 * Statement structure (text extracted by pdf-parse-new):
 *   1. Header: Revolut Ltd, period, generation date, client PII
 *   2. "Summary for Brokerage Account - EUR":
 *        Sells summary
 *          Gross proceeds  €X
 *          Cost basis      €Y
 *          Realised gross PnL €Z
 *        Other Income and Fees summary
 *          Dividends         €X
 *          Withholding tax   $Y
 *          Amount            €Z
 *   3. "Transactions for Brokerage Account — Sells - EUR":
 *        One row per sale, multi-line shape:
 *          MMM DD, YYYY       (purchase date)
 *          MMM DD, YYYY       (sale date)
 *          Security name SYM
 *          ISIN
 *          CC qty             (country code + quantity)
 *          €cost_eur
 *          cost_ron RON
 *          Rate: cost_rate
 *          €proceeds_eur
 *          proceeds_ron RON
 *          Rate: proceeds_rate
 *          €pnl_eur
 *          pnl_ron RON
 *          €fees_eur
 *          fees_ron RON
 *
 * Output shape compatible with the existing portfolio resolvers so the
 * income-resolvers layer can treat Revolut alongside XTB / Tradeville / BT.
 */

'use strict';

const { parseNumber } = require('../rates');

/**
 * Parse a Revolut consolidated statement PDF text.
 *
 * @param {string} text  Raw text extracted by pdf-parse-new
 * @param {number} year  Fiscal year (used as fallback context only — the
 *                       statement carries its own dates per sale)
 * @returns {object}     Statement summary + per-sale detail + per-country
 *                       aggregates ready for cap14 emission.
 */
function parseRevolutStatement(text, year) {
  // Detect the brokerage account currency from the section header. Revolut
  // issues separate statements per currency (EUR, USD, GBP, ...) — we read
  // the currency from "Summary for Brokerage Account - <CCY>" and from any
  // symbol prefix we find (€, $, £). When detection fails we default to
  // EUR which is the most common case for Romanian Revolut users.
  const currency = _detectCurrency(text);
  const symbol = _currencySymbol(currency);

  const result = {
    year,
    source: 'Revolut',
    broker: 'Revolut Securities Europe UAB',
    // Detected currency for downstream display + FX conversion. `currency`
    // and `symbol` are the canonical fields going forward; the *EUR aliases
    // below are kept for backward compatibility with existing UI callers.
    currency,
    symbol,
    // High-level summary as printed at the top of the PDF.
    summary: {
      currency,
      grossProceeds: 0,
      costBasis: 0,
      realisedPnL: 0,
      dividends: 0,
      withholdingTaxUSD: 0,
      otherAmount: 0,
      // Legacy aliases (currency might not be EUR but renaming the field
      // names breaks existing storage / UI). Cleaned up in a follow-up.
      grossProceedsEUR: 0,
      costBasisEUR: 0,
      realisedPnLEUR: 0,
      dividendsEUR: 0,
      otherAmountEUR: 0,
    },
    // Per-sale detail. The user can verify each row matches their broker.
    sales: [],
    // Aggregated per-country buckets for cap14 emission. Revolut never
    // withholds tax on capital gains at source → taxWithheldRON is always 0.
    countries: [],
    longTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
    shortTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
    totalGainRON: 0,
    totalTaxWithheldRON: 0,
    // Treaty / withholding note surfaced to the UI so the user knows why
    // their cap-gains credit fiscal is 0.
    foreignTaxCredit: 0,
    foreignBroker: true,
  };

  // Currency symbol pattern (escaped so € / $ / £ all work safely inside
  // a character class) used by every summary + per-row regex below.
  const ANY_SYM = '[€$£¥]';

  // ---- Summary section ----
  const grossM = text.match(new RegExp(`Gross proceeds\\s*\\n?\\s*${ANY_SYM}?([\\d.,]+)`, 'i'));
  if (grossM) {
    const v = parseNumber(grossM[1]);
    result.summary.grossProceeds = v;
    result.summary.grossProceedsEUR = v;  // legacy alias
  }
  const costM = text.match(new RegExp(`Cost basis\\s*\\n?\\s*${ANY_SYM}?([\\d.,]+)`, 'i'));
  if (costM) {
    const v = parseNumber(costM[1]);
    result.summary.costBasis = v;
    result.summary.costBasisEUR = v;
  }
  const pnlM = text.match(new RegExp(`Realised gross PnL\\s*\\n?\\s*${ANY_SYM}?([\\d.,\\-]+)`, 'i'));
  if (pnlM) {
    const v = parseNumber(pnlM[1]);
    result.summary.realisedPnL = v;
    result.summary.realisedPnLEUR = v;
  }
  const divM = text.match(new RegExp(`Dividends\\s*\\n?\\s*${ANY_SYM}?([\\d.,]+)`, 'i'));
  if (divM) {
    const v = parseNumber(divM[1]);
    result.summary.dividends = v;
    result.summary.dividendsEUR = v;
  }
  // Withholding tax on US dividends is always reported in USD by Revolut
  // regardless of the brokerage-account currency. Keep the USD label.
  const whM = text.match(/Withholding tax\s*\n?\s*\$?([\d.,]+)/i);
  if (whM) result.summary.withholdingTaxUSD = parseNumber(whM[1]);

  // ---- Sales transactions ----
  // Extract the Sells section so the row regex doesn't accidentally match
  // the Summary numbers or the Glossary boilerplate at the end.
  const sellsStart = text.search(/Transactions\s+for\s+Brokerage\s+Account\s*[—\-]\s*Sells/i);
  const sellsEnd = text.search(/Information\s+about\s+Brokerage\s+Account\s+statement/i);
  if (sellsStart < 0) return result;
  const sellsBody = text.slice(sellsStart, sellsEnd > sellsStart ? sellsEnd : text.length);

  // Row pattern: 2 dates, security name + symbol, ISIN, country + qty, then
  // 4 numeric blocks (cost / proceeds / pnl / fees). The `Rate:` line is
  // optional on rows where Revolut printed amounts in foreign-currency-only
  // (rare on the tax report but defensive).
  //
  // We anchor on the ISIN (12 chars, [A-Z]{2}[A-Z0-9]{9}\d) because it is
  // the most stable token: tickers can be 1-5 chars, security names can
  // contain spaces and punctuation.
  const isinRe = /([A-Z]{2}[A-Z0-9]{9}\d)/g;
  const isinPositions = [];
  let m;
  while ((m = isinRe.exec(sellsBody)) !== null) {
    isinPositions.push({ isin: m[1], at: m.index });
  }

  for (let i = 0; i < isinPositions.length; i++) {
    const isin = isinPositions[i].isin;
    const start = isinPositions[i].at;
    const end = i + 1 < isinPositions.length ? isinPositions[i + 1].at : sellsBody.length;
    const before = sellsBody.slice(Math.max(0, start - 400), start);
    const after = sellsBody.slice(start, end);

    // Two dates immediately preceding the ISIN block.
    const dateMatches = [...before.matchAll(/([A-Z][a-z]{2}\s+\d{1,2},\s*\d{4})/g)];
    const last2Dates = dateMatches.slice(-2);
    const purchaseDate = last2Dates.length >= 2 ? last2Dates[0][1] : '';
    const saleDate = last2Dates.length >= 2 ? last2Dates[1][1] : (last2Dates[0] ? last2Dates[0][1] : '');

    // Security name + symbol from the last non-date line before the ISIN.
    const lines = before.split(/\n/);
    let securityLine = '';
    for (let j = lines.length - 1; j >= 0; j--) {
      const ln = lines[j].trim();
      if (ln && !ln.match(/^[A-Z][a-z]{2}\s+\d{1,2},/)) { securityLine = ln; break; }
    }
    const symMatch = securityLine.match(/^(.+?)\s+([A-Z0-9.]{1,6})$/);
    const securityName = symMatch ? symMatch[1].trim() : securityLine;
    const tickerSymbol = symMatch ? symMatch[2] : '';

    // Country code + qty on the line immediately after the ISIN.
    const countryQtyMatch = after.match(/^[A-Z0-9]{12}\s*\n?\s*([A-Z]{2})\s+([\d.,]+)/);
    const country = countryQtyMatch ? countryQtyMatch[1] : '';
    const quantity = countryQtyMatch ? parseNumber(countryQtyMatch[2]) : 0;

    // Foreign-currency values: any of €/$/£ prefix. RON values keep their
    // explicit "RON" suffix. Per-leg BNR rate parsed separately.
    const FX_VAL_RE = new RegExp(`${ANY_SYM}\\s*([\\-]?[\\d.,]+)`, 'g');
    const foreignValues = [...after.matchAll(FX_VAL_RE)].map(x => parseNumber(x[1]));
    const ronValues = [...after.matchAll(/([\-]?[\d.,]+)\s*RON/g)].map(x => parseNumber(x[1]));
    const rateValues = [...after.matchAll(/Rate:\s*([\d.,]+)/g)].map(x => parseNumber(x[1]));

    // Defensive bail: a complete row needs 4 foreign + 4 RON values.
    if (foreignValues.length < 4 || ronValues.length < 4) continue;

    const sale = {
      purchaseDate,
      saleDate,
      securityName,
      symbol: tickerSymbol,
      isin,
      country,
      quantity,
      currency,
      costBasis: foreignValues[0],
      costBasisRON: ronValues[0],
      costBasisRate: rateValues[0] || 0,
      proceeds: foreignValues[1],
      proceedsRON: ronValues[1],
      proceedsRate: rateValues[1] || 0,
      pnl: foreignValues[2],
      pnlRON: ronValues[2],
      fees: foreignValues[3],
      feesRON: ronValues[3],
      // Legacy *EUR aliases — see `summary.grossProceedsEUR` rationale.
      costBasisEUR: foreignValues[0],
      proceedsEUR: foreignValues[1],
      pnlEUR: foreignValues[2],
      feesEUR: foreignValues[3],
      // Holding period in days (used to bucket long vs short for D212).
      holdingDays: _daysBetween(purchaseDate, saleDate),
    };
    sale.bucket = sale.holdingDays >= 365 ? 'long' : 'short';
    result.sales.push(sale);
  }

  // ---- Aggregate per country and per bucket ----
  const byCountry = new Map();
  for (const s of result.sales) {
    const key = s.country || 'XX';
    if (!byCountry.has(key)) {
      byCountry.set(key, {
        country: key,
        currency: s.currency || currency,
        longGain: 0, longLoss: 0, longTax: 0,
        shortGain: 0, shortLoss: 0, shortTax: 0,
        longGainRON: 0, longLossRON: 0, longTaxRON: 0,
        shortGainRON: 0, shortLossRON: 0, shortTaxRON: 0,
      });
    }
    const c = byCountry.get(key);
    const isLong = s.bucket === 'long';
    if (s.pnlRON >= 0) {
      if (isLong) {
        c.longGain += s.pnl; c.longGainRON += s.pnlRON;
      } else {
        c.shortGain += s.pnl; c.shortGainRON += s.pnlRON;
      }
    } else {
      const lossForeign = -s.pnl;
      const lossRON = -s.pnlRON;
      if (isLong) {
        c.longLoss += lossForeign; c.longLossRON += lossRON;
      } else {
        c.shortLoss += lossForeign; c.shortLossRON += lossRON;
      }
    }
  }
  result.countries = Array.from(byCountry.values());

  for (const c of result.countries) {
    result.longTerm.gainRON += c.longGainRON;
    result.longTerm.lossRON += c.longLossRON;
    result.shortTerm.gainRON += c.shortGainRON;
    result.shortTerm.lossRON += c.shortLossRON;
  }
  result.totalGainRON = result.longTerm.gainRON + result.shortTerm.gainRON
    - result.longTerm.lossRON - result.shortTerm.lossRON;
  result.totalTaxWithheldRON = 0;

  return result;
}

/**
 * Detect the brokerage-account currency from the statement text.
 * Looks for "Summary for Brokerage Account - <CCY>" (canonical header),
 * "Sells - <CCY>", or falls back to scanning for the first currency symbol.
 * Defaults to "EUR" for Romanian Revolut users when nothing matches.
 *
 * @param {string} text
 * @returns {string} Three-letter currency code
 */
function _detectCurrency(text) {
  const m1 = text.match(/Brokerage\s+Account\s*[-—]\s*(EUR|USD|GBP|CHF|RON|HUF|PLN|JPY)\b/i);
  if (m1) return m1[1].toUpperCase();
  const m2 = text.match(/Sells\s*[-—]\s*(EUR|USD|GBP|CHF|RON|HUF|PLN|JPY)\b/i);
  if (m2) return m2[1].toUpperCase();
  // Symbol fallback. €/$/£ are unambiguous; ¥ could be JPY or CNY but we
  // bias to JPY which Revolut uses more commonly.
  if (text.indexOf('€') >= 0) return 'EUR';
  if (text.indexOf('£') >= 0) return 'GBP';
  if (text.indexOf('$') >= 0) return 'USD';
  if (text.indexOf('¥') >= 0) return 'JPY';
  return 'EUR';
}

/** Map a 3-letter currency code to its display symbol. */
function _currencySymbol(code) {
  switch ((code || '').toUpperCase()) {
    case 'EUR': return '€';
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'JPY': return '¥';
    case 'CHF': return 'CHF';
    case 'RON': return 'RON';
    default: return code || '';
  }
}

/**
 * Parse a "MMM DD, YYYY" date string (Revolut's format) into a Date.
 * Returns null on parse failure.
 */
function _parseDate(str) {
  if (!str) return null;
  const m = String(str).match(/([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const monthIdx = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(m[1]);
  if (monthIdx < 0) return null;
  return new Date(Date.UTC(parseInt(m[3], 10), monthIdx, parseInt(m[2], 10)));
}

function _daysBetween(purchaseStr, saleStr) {
  const p = _parseDate(purchaseStr);
  const s = _parseDate(saleStr);
  if (!p || !s) return 0;
  return Math.round((s - p) / (1000 * 60 * 60 * 24));
}

module.exports = {
  parseRevolutStatement,
};
