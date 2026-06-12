/**
 * XTB Romania report parsers.
 *
 * Parses two report types from XTB S.A. Varsovia Sucursala București:
 *   1. RAPORT DIVIDENDE SI DOBANZI — dividends + interest paid in the period
 *   2. FIŞĂ DE PORTOFOLIU — capital gains/losses per country and holding bucket
 *
 * Both parsers handle multi-row reports and per-row currency (RON / EUR / USD),
 * converting non-RON amounts to RON using BNR annual averages.
 */

const { toRON, parseNumber, detectCurrency, roCountryNameToIso } = require('../rates');

/**
 * Parse the XTB Dividends & Interest annual report.
 * Returns aggregated RON totals (backwards-compatible scalars) plus per-row
 * detail in dividendRows[] and interestRows[].
 */
function parseXtbDividends(text, year) {
  const result = {
    year,
    source: 'XTB Romania',
    dividends: { grossRON: 0, taxWithheldRON: 0, netRON: 0, category: '' },
    interest: { grossRON: 0, taxWithheldRON: 0, netRON: 0, payer: '' },
    dividendRows: [],
    interestRows: [],
    // Per-country aggregates. XTB doesn't print ISIN in its annual report
    // (it groups by "Instrumente ... din <Country in Romanian>"), so we
    // resolve the country name to ISO Alpha-2 via lib/rates.roCountryNameToIso.
    // `country` is null when the description didn't contain a "din <X>" hint.
    dividendsByCountry: [],
  };

  const splitIdx = text.search(/venit\s+anual\s+din\s+dob[aâ]nzi/i);
  const dividendsText = splitIdx >= 0 ? text.slice(0, splitIdx) : text;
  const interestText = splitIdx >= 0 ? text.slice(splitIdx) : '';

  const ROW_RE = /^\s*(\d+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+(.+)$/gm;

  // Pull the country name out of an XTB description line. Examples:
  //   "Instrumente cu detinere (OMI) din Statele Unite"   → "Statele Unite"
  //   "Instrumente din Germania"                           → "Germania"
  //   "Instrumente cu detinere ... din Marea Britanie"     → "Marea Britanie"
  // Returns null when no "din X" suffix is found.
  const extractCountryName = (desc) => {
    const m = /\bdin\s+([A-Za-zĂÂÎȘȚăâîșțĂÂÎȘŢ \-]+?)\s*$/.exec(desc);
    return m ? m[1].trim() : null;
  };

  const countryBuckets = new Map();
  for (const m of dividendsText.matchAll(ROW_RE)) {
    const gross = parseNumber(m[2]);
    const tax = parseNumber(m[3]);
    const net = parseNumber(m[4]);
    const desc = m[5].trim();
    if (!gross && !tax && !net) continue;
    if (!/Instrumente|dividende|actiun|acțiun/i.test(desc)) continue;
    const currency = detectCurrency(desc, text);
    const grossRON = toRON(gross, currency, year);
    const taxRON = toRON(tax, currency, year);
    const netRON = toRON(net, currency, year);
    const countryName = extractCountryName(desc);
    const country = roCountryNameToIso(countryName);
    result.dividendRows.push({ currency, gross, tax, net, grossRON, taxRON, netRON, category: desc, country, countryName });
    result.dividends.grossRON += grossRON;
    result.dividends.taxWithheldRON += taxRON;
    result.dividends.netRON += netRON;
    if (!result.dividends.category) result.dividends.category = desc;

    const key = country || '?';
    const bucket = countryBuckets.get(key) || {
      country,
      countryName: countryName || null,
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

  for (const m of interestText.matchAll(ROW_RE)) {
    const gross = parseNumber(m[2]);
    const tax = parseNumber(m[3]);
    const net = parseNumber(m[4]);
    const payer = m[5].trim();
    if (!gross && !tax && !net) continue;
    if (!/XTB|S\.?A\.?|sucursala|sursa/i.test(payer)) continue;
    const currency = detectCurrency(payer, text);
    const grossRON = toRON(gross, currency, year);
    const taxRON = toRON(tax, currency, year);
    const netRON = toRON(net, currency, year);
    result.interestRows.push({ currency, gross, tax, net, grossRON, taxRON, netRON, payer });
    result.interest.grossRON += grossRON;
    result.interest.taxWithheldRON += taxRON;
    result.interest.netRON += netRON;
    if (!result.interest.payer) result.interest.payer = payer;
  }

  return result;
}

/**
 * Parse the XTB Portfolio Statement (Fișa de Portofoliu).
 * Captures all country rows, each with its own currency.
 * Country names are cleaned: "Instrumente cu detinere (OMI) din Statele Unite"
 * becomes "Statele Unite".
 */
function parseXtbPortfolio(text, year) {
  const result = {
    year,
    source: 'XTB Romania',
    longTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
    shortTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
    country: '',
    currency: 'RON',
    totalGainRON: 0,
    totalTaxWithheldRON: 0,
    countries: []
  };

  const rowRe = /([A-Za-zĂÂÎȘȚăâîșțţ][A-Za-zĂÂÎȘȚăâîșțţ\s().,\-]*?)\s+(RON|EUR|USD)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/g;

  for (const m of text.matchAll(rowRe)) {
    let country = m[1].replace(/\s+/g, ' ').trim();
    const currency = m[2];
    const longGain = parseNumber(m[3]);
    const longLoss = parseNumber(m[4]);
    const longTax = parseNumber(m[5]);
    const shortGain = parseNumber(m[6]);
    const shortLoss = parseNumber(m[7]);
    const shortTax = parseNumber(m[8]);

    if (/^(Câ?știg|Pierdere|Impozit|Moneda|Nr|Cod|RON|EUR|USD)/i.test(country)) continue;
    if (longGain === 0 && longLoss === 0 && longTax === 0 && shortGain === 0 && shortLoss === 0 && shortTax === 0) continue;

    country = country.replace(/^\d+\s+/, '').replace(/\s+\d+$/, '').trim();
    const dinMatch = country.match(/\bdin\s+(.+)$/i);
    if (dinMatch) country = dinMatch[1].trim();

    result.countries.push({
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

  result.totalGainRON = result.longTerm.gainRON + result.shortTerm.gainRON - result.longTerm.lossRON - result.shortTerm.lossRON;
  result.totalTaxWithheldRON = result.longTerm.taxWithheldRON + result.shortTerm.taxWithheldRON;

  return result;
}

module.exports = {
  parseXtbDividends,
  parseXtbPortfolio,
};
