/**
 * BNR exchange rates and currency helpers.
 *
 * Single source of truth for the BNR annual-average exchange rates used
 * across the app for converting EUR/USD amounts to RON in capital gains,
 * dividend and interest calculations.
 *
 * Source: https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice
 */

const BNR_EXCHANGE_RATES = {
  2019: { usdRon: 4.2379, eurRon: 4.7452, source: 'BNR' },
  2020: { usdRon: 4.2440, eurRon: 4.8371, source: 'BNR' },
  2021: { usdRon: 4.1604, eurRon: 4.9204, source: 'BNR' },
  2022: { usdRon: 4.6885, eurRon: 4.9315, source: 'BNR' },
  2023: { usdRon: 4.5743, eurRon: 4.9465, source: 'BNR' },
  2024: { usdRon: 4.5984, eurRon: 4.9746, source: 'BNR' },
  2025: { usdRon: 4.4705, eurRon: 5.0415, source: 'BNR' },
};

/**
 * Convert an amount in the given currency code to RON using BNR annual averages.
 * - Falsy amounts return 0.
 * - RON (or unknown currencies) return the amount as-is.
 * - For unknown years, leaves the amount unchanged; callers should warn.
 */
function toRON(amount, currency, year) {
  const cur = String(currency || 'RON').toUpperCase();
  if (!amount) return amount || 0;
  if (cur === 'RON') return amount;
  const rates = BNR_EXCHANGE_RATES[year];
  if (!rates) return amount;
  if (cur === 'EUR') return amount * rates.eurRon;
  if (cur === 'USD') return amount * rates.usdRon;
  return amount;
}

/**
 * Parse a numeric string.
 * Compatible with US-style thousand separators (e.g. "1,234.56" → 1234.56).
 * Returns NaN for non-numeric input (callers typically use `value || 0`).
 */
function parseNumber(str) {
  if (!str) return 0;
  return parseFloat(str.toString().replace(/,/g, ''));
}

/**
 * Detect the currency of an XTB report row.
 * XTB Romania reports default to RON (column header says "în RON"), but rows
 * occasionally carry their own "(în EUR)" / "USD" hint in the description.
 *
 * Note: we avoid `\bîn` because `î` is not a word character in JS regex without
 * the /u flag, which would cause valid Romanian phrases like "în EUR" to be
 * skipped. We use a non-word lookbehind on a space or start-of-text instead.
 */
function detectCurrency(rowText, fullText) {
  const t = String(rowText || '');
  if (/\bEUR\b/i.test(t)) return 'EUR';
  if (/\bUSD\b/i.test(t)) return 'USD';
  if (/\bRON\b/i.test(t)) return 'RON';
  // Fall back to whatever the document header says ("în EUR" / "în USD").
  if (fullText && /(?:^|\s)în\s+EUR\b/i.test(fullText) && !/(?:^|\s)în\s+RON\b/i.test(fullText)) return 'EUR';
  if (fullText && /(?:^|\s)în\s+USD\b/i.test(fullText) && !/(?:^|\s)în\s+RON\b/i.test(fullText)) return 'USD';
  return 'RON';
}

/**
 * ISO 3166-1 Alpha-2 country codes accepted by ANAF D212 Schematron
 * rule CD-D212-011 (docs/anaf/d212-2025/codes/d212-codes.sch lines 286-336).
 * Used for validating `str_stat_realiz_v` and related country attributes
 * before emitting cap14 rows. ANAF also allows XI (Northern Ireland) and
 * XK (Kosovo) which are not strictly ISO 3166-1.
 *
 * Codes outside this list (e.g. XS for Eurobonds, XX placeholder) MUST
 * NOT be emitted to D212 XML — the caller should warn and skip the row.
 */
const D212_ALLOWED_COUNTRY_CODES = new Set([
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
  'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
  'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
  'DE','DJ','DK','DM','DO','DZ',
  'EC','EE','EG','EH','ER','ES','ET',
  'FI','FJ','FK','FM','FO','FR',
  'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
  'HK','HM','HN','HR','HT','HU',
  'ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
  'JE','JM','JO','JP',
  'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
  'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
  'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
  'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ',
  'OM',
  'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY',
  'QA',
  'RE','RO','RS','RU','RW',
  'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
  'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
  'UA','UG','UM','US','UY','UZ',
  'VA','VC','VE','VG','VI','VN','VU',
  'WF','WS',
  'XI','XK',
  'YE','YT',
  'ZA','ZM','ZW',
]);

/**
 * ISO Alpha-2 code → Romanian country name, for cap14 `den_stat` and for
 * showing country labels in the UI. Extended on demand as new brokers add
 * countries. Only the codes likely to appear in retail investor reports
 * are listed; for missing codes the caller falls back to the code itself.
 */
const COUNTRY_CODE_TO_RO = {
  AT: 'Austria',
  AU: 'Australia',
  BE: 'Belgia',
  BG: 'Bulgaria',
  BR: 'Brazilia',
  CA: 'Canada',
  CH: 'Elveția',
  CN: 'China',
  CY: 'Cipru',
  CZ: 'Cehia',
  DE: 'Germania',
  DK: 'Danemarca',
  EE: 'Estonia',
  ES: 'Spania',
  FI: 'Finlanda',
  FR: 'Franța',
  GB: 'Marea Britanie',
  GR: 'Grecia',
  HK: 'Hong Kong',
  HR: 'Croația',
  HU: 'Ungaria',
  IE: 'Irlanda',
  IL: 'Israel',
  IN: 'India',
  IT: 'Italia',
  JP: 'Japonia',
  KR: 'Coreea de Sud',
  LT: 'Lituania',
  LU: 'Luxemburg',
  LV: 'Letonia',
  MX: 'Mexic',
  NL: 'Olanda',
  NO: 'Norvegia',
  NZ: 'Noua Zeelandă',
  PL: 'Polonia',
  PT: 'Portugalia',
  RO: 'România',
  SE: 'Suedia',
  SG: 'Singapore',
  SI: 'Slovenia',
  SK: 'Slovacia',
  TR: 'Turcia',
  US: 'Statele Unite ale Americii',
  ZA: 'Africa de Sud',
};

/**
 * Romanian country name (as it appears in XTB / BT reports) → ISO Alpha-2.
 * Lower-case keys for case-insensitive lookup; both long and common short
 * forms are included (e.g. "Statele Unite" and "Statele Unite ale Americii"
 * both map to US).
 */
const COUNTRY_RO_TO_CODE = {
  'austria': 'AT',
  'australia': 'AU',
  'belgia': 'BE',
  'bulgaria': 'BG',
  'brazilia': 'BR',
  'canada': 'CA',
  'elvetia': 'CH',
  'elveția': 'CH',
  'china': 'CN',
  'cipru': 'CY',
  'cehia': 'CZ',
  'germania': 'DE',
  'danemarca': 'DK',
  'estonia': 'EE',
  'spania': 'ES',
  'finlanda': 'FI',
  'franta': 'FR',
  'franța': 'FR',
  'marea britanie': 'GB',
  'regatul unit': 'GB',
  'regatul unit al marii britanii': 'GB',
  'grecia': 'GR',
  'hong kong': 'HK',
  'croatia': 'HR',
  'croația': 'HR',
  'ungaria': 'HU',
  'irlanda': 'IE',
  'israel': 'IL',
  'india': 'IN',
  'italia': 'IT',
  'japonia': 'JP',
  'coreea de sud': 'KR',
  'lituania': 'LT',
  'luxemburg': 'LU',
  'letonia': 'LV',
  'mexic': 'MX',
  'olanda': 'NL',
  'tarile de jos': 'NL',
  'țările de jos': 'NL',
  'norvegia': 'NO',
  'noua zeelanda': 'NZ',
  'noua zeelandă': 'NZ',
  'polonia': 'PL',
  'portugalia': 'PT',
  'romania': 'RO',
  'românia': 'RO',
  'suedia': 'SE',
  'singapore': 'SG',
  'slovenia': 'SI',
  'slovacia': 'SK',
  'turcia': 'TR',
  'statele unite': 'US',
  'statele unite ale americii': 'US',
  's.u.a.': 'US',
  'sua': 'US',
  'africa de sud': 'ZA',
};

/**
 * Resolve a Romanian country name (possibly with diacritics, prefix words,
 * exchange suffix) to an ISO Alpha-2 code.
 *
 * Examples:
 *   roCountryNameToIso('Statele Unite ale Americii')  → 'US'
 *   roCountryNameToIso('din Germania')                → 'DE'
 *   roCountryNameToIso('Marea Britanie / LSE')        → 'GB'
 *   roCountryNameToIso('ROMANIA / BVB')               → 'RO'
 *   roCountryNameToIso('Mauretania')                  → null  (unknown)
 *
 * Returns `null` for unknown names. The caller should surface a warning
 * and skip the row from D212 XML emission rather than guessing.
 */
function roCountryNameToIso(name) {
  if (!name) return null;
  let t = String(name).toLowerCase().trim();
  t = t.replace(/^din\s+/, '');
  t = t.split(/\s*[\/,\(]/)[0].trim();
  if (COUNTRY_RO_TO_CODE[t]) return COUNTRY_RO_TO_CODE[t];
  for (const [k, v] of Object.entries(COUNTRY_RO_TO_CODE)) {
    if (t.startsWith(k) || k.startsWith(t)) return v;
  }
  return null;
}

/**
 * Extract the ISO Alpha-2 country code from the first two characters of an
 * ISIN (e.g. 'US0378331005' → 'US', 'ROTLVAACNOR1' → 'RO'). Returns null
 * if the input doesn't look like an ISIN.
 *
 * Note: ISIN[0..2] is the country of registration / issue, not necessarily
 * the issuer's tax residence (e.g. Ireland UCITS ETFs are 'IE' even if
 * holdings are global). For D212 cap14 emission this is the correct value
 * because str_stat_realiz_v expects the source-state of the income (where
 * the paying entity is incorporated).
 */
function isinToCountryCode(isin) {
  if (!isin) return null;
  const s = String(isin).trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(s)) return null;
  return s.slice(0, 2);
}

module.exports = {
  BNR_EXCHANGE_RATES,
  toRON,
  parseNumber,
  detectCurrency,
  D212_ALLOWED_COUNTRY_CODES,
  COUNTRY_CODE_TO_RO,
  COUNTRY_RO_TO_CODE,
  roCountryNameToIso,
  isinToCountryCode,
};
