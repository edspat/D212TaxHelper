/**
 * BT Capital Partners (Banca Transilvania / bt-trade.ro) report parsers.
 *
 * Parses the two annual statements that BT Capital Partners issues to clients
 * who trade through the bt-trade.ro platform:
 *   1. "DIVIDENDE/DOBANZI INCASATE PE PIETE EXTERNE" (FisaDividende_*_INTL.pdf)
 *      Per-payment dividend / interest detail, one row per payment, with
 *      symbol, ISIN, currency, gross-per-unit, withholding rate, tax,
 *      net amount and dates.
 *   2. "FISA DE PORTOFOLIU" (PortfolioSheet*.pdf)
 *      Per-country / per-exchange capital-gains summary split into the two
 *      D212 holding-period buckets (≥365 days = long, <365 days = short).
 *
 * Both parsers convert non-RON amounts to RON using the BNR annual averages
 * from lib/rates.js and produce shapes compatible with the XTB / Tradeville
 * parsers so that downstream resolvers (income-resolvers.js) can treat all
 * three brokers identically.
 */

'use strict';

const { toRON, parseNumber, isinToCountryCode } = require('../rates');

/**
 * Parse the BT Capital Partners "Fisa Dividende" PDF.
 *
 * Sample row (extracted text, one logical row per payment):
 *   SYM EUR NL0000235190 100 24.04.2025 1.00000000 15.00 % 100.00 15.00 0.00 85.00 24.04.2025
 *   ─symbol  ─cur ─ISIN     ─qty ─pay-date  ─per-unit  ─rate   ─gross  ─tax  ─other  ─net  ─receipt-date
 *
 * The row order in the printed table is: SIMBOL | MONEDA | ISIN | CANTITATE |
 * DATA PLATII | BRUT PE UNITATE | COTA | IMPOZIT BRUT | IMPOZIT | ALTE TAXE |
 * NET | DATA INCASARII. The COTA column carries a literal "%" sign which we
 * absorb but do not use (the IMPOZIT BRUT and IMPOZIT amounts are already the
 * computed values).
 *
 * @param {string} text  Raw extracted PDF text
 * @param {number} year  Fiscal year (used for BNR FX conversion)
 * @returns {object}     Shape compatible with parseXtbDividends so the
 *                       resolver can sum BT + XTB transparently.
 */
function parseBtDividends(text, year) {
  const result = {
    year,
    source: 'BT Capital Partners',
    broker: 'BT Capital Partners',
    dividends: { grossRON: 0, taxWithheldRON: 0, netRON: 0, category: 'Dividende externe' },
    // BT's Fisa Dividende includes interest payments under the same template
    // (the file label literally says "DIVIDENDE/DOBANZI"). We expose both
    // buckets so the resolver can route interest separately if needed; in
    // practice the bt-trade INTL form only carries dividends for most users.
    interest: { grossRON: 0, taxWithheldRON: 0, netRON: 0, payer: '' },
    dividendRows: [],
    interestRows: [],
    // Per-country aggregates derived from the ISIN prefix on each row.
    // Consumed by computeYearData to emit cap14 rows (foreign source) or
    // surface RO-source dividends separately. `country` is ISO 3166-1
    // Alpha-2; `null` when the ISIN didn't parse as a valid 12-char code.
    dividendsByCountry: [],
  };

  // Row regex anchored on the ISIN code (12-char alphanumeric — globally
  // unique per security). This is more robust than anchoring on the symbol
  // which can vary widely (1-5 chars, may include digits).
  //   symbol  currency  ISIN          qty        pay-date     per-unit       rate%         gross         tax         other         net           receipt-date
  const ROW_RE = /([A-Z0-9]{1,8})\s+(RON|EUR|USD|GBP|CHF)\s+([A-Z]{2}[A-Z0-9]{9}\d)\s+([\d.,]+)\s+(\d{2}\.\d{2}\.\d{4})\s+([\d.,]+)\s+([\d.,]+)\s*%\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+(\d{2}\.\d{2}\.\d{4})/g;

  const countryBuckets = new Map();
  for (const m of text.matchAll(ROW_RE)) {
    const symbol = m[1];
    const currency = m[2];
    const isin = m[3];
    const quantity = parseNumber(m[4]);
    const payDate = m[5];
    const perUnit = parseNumber(m[6]);
    const rate = parseNumber(m[7]);
    const gross = parseNumber(m[8]);
    const tax = parseNumber(m[9]);
    const otherFees = parseNumber(m[10]);
    const net = parseNumber(m[11]);
    const receiptDate = m[12];

    if (!gross && !tax && !net) continue;

    const grossRON = toRON(gross, currency, year);
    const taxRON = toRON(tax, currency, year);
    const netRON = toRON(net, currency, year);
    const country = isinToCountryCode(isin);

    result.dividendRows.push({
      symbol,
      isin,
      country,
      currency,
      quantity,
      payDate,
      receiptDate,
      perUnit,
      withholdingRate: rate,
      gross, tax, otherFees, net,
      grossRON, taxRON, netRON,
    });
    result.dividends.grossRON += grossRON;
    result.dividends.taxWithheldRON += taxRON;
    result.dividends.netRON += netRON;

    const key = country || '?';
    const bucket = countryBuckets.get(key) || {
      country,
      isRomanian: country === 'RO',
      grossRON: 0, taxRON: 0, netRON: 0,
      rowCount: 0,
    };
    bucket.grossRON += grossRON;
    bucket.taxRON += taxRON;
    bucket.netRON += netRON;
    bucket.rowCount += 1;
    countryBuckets.set(key, bucket);
  }
  result.dividendsByCountry = Array.from(countryBuckets.values());

  return result;
}

/**
 * Parse the BT Capital Partners "Fisa de Portofoliu" PDF.
 *
 * Sample row (extracted text, one row per country/exchange combination):
 *   1 ROMANIA / BVB RON 0.00 0.00 0.00 11.40 761.14 0.00
 *   N  country/exchange  cur  long_gain long_loss long_tax  short_gain short_loss short_tax
 *
 * The exchange suffix (e.g. "BVB", "XETRA Frankfurt", "Euronext Paris") is
 * kept as part of the country label because it disambiguates Frankfurt vs
 * other German exchanges if the user ever uses multiple.
 *
 * @param {string} text  Raw extracted PDF text
 * @param {number} year  Fiscal year
 * @returns {object}     Shape compatible with parseXtbPortfolio.
 */
function parseBtPortfolio(text, year) {
  const result = {
    year,
    source: 'BT Capital Partners',
    broker: 'BT Capital Partners',
    longTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
    shortTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
    country: '',
    currency: 'RON',
    totalGainRON: 0,
    totalTaxWithheldRON: 0,
    countries: [],
  };

  // Row regex:
  //   leading "Nr.crt" digit, then country label (letters + slashes + spaces),
  //   then currency, then exactly 6 numeric columns. Anchored with \n to skip
  //   header rows like "Castig Pierdere Impozit..." which lack the leading
  //   integer.
  const rowRe = /\n\s*(\d+)\s+([A-ZĂÂÎȘȚa-zăâîșțţ][A-ZĂÂÎȘȚa-zăâîșțţ\s().,\-\/]*?)\s+(RON|EUR|USD|GBP|CHF)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/g;

  for (const m of text.matchAll(rowRe)) {
    const nr = parseInt(m[1], 10);
    let country = m[2].replace(/\s+/g, ' ').trim();
    const currency = m[3];
    const longGain = parseNumber(m[4]);
    const longLoss = parseNumber(m[5]);
    const longTax = parseNumber(m[6]);
    const shortGain = parseNumber(m[7]);
    const shortLoss = parseNumber(m[8]);
    const shortTax = parseNumber(m[9]);

    // Sanity gate: skip rows where everything is zero (BT prints empty
    // placeholder rows in some statement variants).
    if (longGain === 0 && longLoss === 0 && longTax === 0 &&
        shortGain === 0 && shortLoss === 0 && shortTax === 0) continue;

    result.countries.push({
      nr,
      country,
      currency,
      longGain, longLoss, longTax,
      shortGain, shortLoss, shortTax,
      longGainRON: toRON(longGain, currency, year),
      longLossRON: toRON(longLoss, currency, year),
      longTaxRON: toRON(longTax, currency, year),
      shortGainRON: toRON(shortGain, currency, year),
      shortLossRON: toRON(shortLoss, currency, year),
      shortTaxRON: toRON(shortTax, currency, year),
    });
  }

  for (const c of result.countries) {
    result.longTerm.gainRON += c.longGainRON;
    result.longTerm.lossRON += c.longLossRON;
    result.longTerm.taxWithheldRON += c.longTaxRON;
    result.shortTerm.gainRON += c.shortGainRON;
    result.shortTerm.lossRON += c.shortLossRON;
    result.shortTerm.taxWithheldRON += c.shortTaxRON;
  }

  if (result.countries.length > 0) {
    result.country = result.countries[0].country;
    const currencies = new Set(result.countries.map(c => c.currency));
    result.currency = currencies.size === 1 ? [...currencies][0] : 'MIXED';
  }

  result.totalGainRON = result.longTerm.gainRON + result.shortTerm.gainRON
    - result.longTerm.lossRON - result.shortTerm.lossRON;
  result.totalTaxWithheldRON = result.longTerm.taxWithheldRON + result.shortTerm.taxWithheldRON;

  return result;
}

module.exports = {
  parseBtDividends,
  parseBtPortfolio,
};
