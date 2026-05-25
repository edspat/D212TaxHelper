/**
 * D205 per-payer matcher.
 *
 * The DUF portal aggregates every D205 a payer filed for the taxpayer into a
 * single `cass_ven_inv` total in the XML export. The detailed payer-level
 * breakdown is visible only in the wizard UI under "Sursa informațiilor în
 * detaliu → Toate sursele". This module compares that manually-collected
 * breakdown against what we can derive from the user's broker PDFs locally,
 * helping them spot:
 *   - payers ANAF has D205 for but we don't have the PDF for (forgot to import?)
 *   - PDFs we have but no matching D205 (payer didn't file? wrong year?)
 *   - amount discrepancies (rounding vs payer error)
 *
 * Match states per ANAF entry (D205 line from the portal):
 *   - 'matched-exact'   : amount difference ≤ 1 RON for an unambiguous payer
 *   - 'matched-amount'  : amount matches but payer attribution is ambiguous
 *   - 'possible'        : same category, amount within near threshold
 *   - 'unmatched-anaf'  : ANAF has it, no local source covers it
 *
 * Plus one terminal state per local source (broker PDF / manual entry):
 *   - 'unmatched-local' : we computed/imported something ANAF doesn't have
 *
 * Local sources currently considered:
 *   * yd.xtbDividendsReport.dividends, .interest         (XTB Dividends PDF)
 *   * yd.xtbPortfolio.countries[].longTax/shortTax       (XTB Portfolio PDF, tax withheld in RON)
 *   * yd.tradevillePortfolio.countries[]                 (Tradeville Portfolio PDF)
 *   * yd.fidelityStatement.dividendsRON / tax            (Fidelity)
 *   * yd.msStatement.dividends / taxWithheld             (Morgan Stanley)
 *   * Manual EUR/USD income entries on Add Data
 *
 * The thresholds (MATCH_EPS, NEAR_ABS, NEAR_REL) come from
 * lib/d212-duf-compare.js so the two cross-checks behave consistently.
 */

'use strict';

const { getCategory } = require('./d205-categories');

const MATCH_EPS = 1;
const NEAR_ABS = 50;          // tighter than the document-level compare; payer-level deltas are usually rounding
const NEAR_REL = 0.005;

/** Normalize a payer name for fuzzy matching (case, accents, common suffixes). */
function normPayerName(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Strip standalone corporate-form tokens (with or without dots/spaces).
    .replace(/\b(s\.?\s?a\.?|s\.?\s?r\.?\s?l\.?|n\.?\s?v\.?)\b/g, ' ')
    .replace(/\b(sa|srl|nv|sucursala|bucuresti|romania|amsterdam|warsaw|varsovia|partners|trust|group)\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Best-effort fingerprint for the broker an XTB / Tradeville etc. entry comes from. */
const BROKER_FINGERPRINTS = [
  { match: /^xtb\b|xtrade brokers/, label: 'XTB' },
  { match: /^bt capital|bt securities/, label: 'BT Capital Partners' },
  { match: /tradeville/, label: 'Tradeville' },
  { match: /goldring/, label: 'Goldring' },
  { match: /^ing\b/, label: 'ING Bank' },
  { match: /^salt\b/, label: 'SALT Bank' },
  { match: /^bcr\b/, label: 'BCR' },
  { match: /^bt\b|banca transilvania/, label: 'Banca Transilvania' },
  { match: /raiffeisen/, label: 'Raiffeisen' },
  { match: /unicredit/, label: 'UniCredit' },
];

function identifyBroker(name) {
  const n = normPayerName(name);
  if (!n) return null;
  for (const fp of BROKER_FINGERPRINTS) {
    if (fp.match.test(n)) return fp.label;
  }
  return null;
}

/** Build the local breakdown by broker from a `computeYearData` result.
 *
 * Important: D205 reports the GROSS gain (sum of profitable trades only),
 * NOT the net gain after subtracting losses. The broker withholds tax per
 * profitable trade, not on the year's net. To match ANAF D205 entries we
 * must therefore sum ONLY the gains and ignore losses for capgains
 * categories 26 / 27. The net (gain - loss) value is what enters the
 * D212 calculation; the gross value here is the one that maps to D205.
 */
function buildLocalBreakdown(yd) {
  const out = [];
  if (!yd || typeof yd !== 'object') return out;
  // XTB dividends + interest
  if (yd.xtbDividendsReport) {
    const d = yd.xtbDividendsReport;
    if (d.dividends && d.dividends.grossRON > 0) {
      // Foreign-source dividends via a Romanian broker DO NOT appear in
      // D205 because the actual payer is the foreign issuer (e.g. a US
      // company), not the Romanian intermediary. Mark them so the matcher
      // can surface them as "expected — not in D205" rather than as a
      // suspicious unmatched-local row.
      out.push({ broker: 'XTB', category: '20', label: 'Dividende', grossRON: d.dividends.grossRON, taxRON: d.dividends.taxWithheldRON || 0, source: 'xtbDividendsReport.dividends', foreignSource: true });
    }
    if (d.interest && d.interest.grossRON > 0) {
      out.push({ broker: 'XTB', category: '09', label: 'Dobânzi', grossRON: d.interest.grossRON, taxRON: d.interest.taxWithheldRON || 0, source: 'xtbDividendsReport.interest' });
    }
  }
  // BT Capital Partners dividends (Fișă Dividende — piețe externe).
  // Foreign-source dividends via a Romanian broker → not in D205 (see
  // XTB note above). Tax IS reported on D205 by the broker but as
  // withholding on dividend payments to non-residents — separate report.
  if (yd.btDividendsReport) {
    const d = yd.btDividendsReport;
    if (d.dividends && d.dividends.grossRON > 0) {
      out.push({ broker: 'BT Capital Partners', category: '20', label: 'Dividende', grossRON: d.dividends.grossRON, taxRON: d.dividends.taxWithheldRON || 0, source: 'btDividendsReport.dividends', foreignSource: true });
    }
  }
  // Portfolio capital gains broken out by short/long, summed across countries.
  // ANAF D205 uses GROSS gain (gains only, no loss offset) per category.
  for (const [src, key] of [['XTB', 'xtbPortfolio'], ['Tradeville', 'tradevillePortfolio'], ['BT Capital Partners', 'btPortfolio']]) {
    const p = yd[key];
    if (!p || !Array.isArray(p.countries)) continue;
    let longGainGross = 0, longTax = 0, shortGainGross = 0, shortTax = 0;
    let longLoss = 0, shortLoss = 0;
    for (const c of p.countries) {
      longGainGross += (c.longGainRON || c.longGain || 0);
      longLoss += (c.longLossRON || c.longLoss || 0);
      longTax += c.longTaxRON || c.longTax || 0;
      shortGainGross += (c.shortGainRON || c.shortGain || 0);
      shortLoss += (c.shortLossRON || c.shortLoss || 0);
      shortTax += c.shortTaxRON || c.shortTax || 0;
    }
    if (longGainGross > 0 || longTax > 0) out.push({
      broker: src, category: '26', label: 'Capgains ≥1y',
      grossRON: longGainGross, lossRON: longLoss,
      taxRON: longTax, source: `${key}.long`,
    });
    if (shortGainGross > 0 || shortTax > 0) out.push({
      broker: src, category: '27', label: 'Capgains <1y',
      grossRON: shortGainGross, lossRON: shortLoss,
      taxRON: shortTax, source: `${key}.short`,
    });
  }
  return out;
}

/**
 * Match D205 entries (manually entered from the DUF wizard) against the
 * local broker breakdown.
 *
 * @param {Array<{payerName:string, payerCif?:string, category:string, grossRON:number, taxRON?:number}>} d205Entries
 * @param {object} yd  yearData (output of computeYearData or raw yd)
 * @returns {{
 *   matches: Array<{anaf: object, local: object|null, status: string, delta: number|null, hint: string}>,
 *   unmatchedLocal: Array<object>,
 *   totals: {exactCount:number, nearCount:number, possibleCount:number, unmatchedAnafCount:number, unmatchedLocalCount:number}
 * }}
 */
function matchD205(d205Entries, yd) {
  const localList = buildLocalBreakdown(yd);
  // Pool that we consume as we find matches. Items not consumed surface as unmatched-local.
  const localPool = localList.map((l, idx) => ({ ...l, _idx: idx, _matched: false }));
  const matches = [];

  for (const a of d205Entries || []) {
    const aGross = Number(a.grossRON) || 0;
    const aBroker = identifyBroker(a.payerName);
    const aCat = String(a.category || '');
    let best = null;
    let bestStatus = null;
    let bestDelta = null;

    // Pass 1: exact (broker + category + |delta| ≤ MATCH_EPS)
    for (const l of localPool) {
      if (l._matched) continue;
      if (l.broker !== aBroker) continue;
      if (l.category !== aCat) continue;
      const d = Math.abs((l.grossRON || 0) - aGross);
      if (d <= MATCH_EPS) {
        best = l; bestStatus = 'matched-exact'; bestDelta = d; break;
      }
    }
    // Pass 2: near (broker + category + within tight threshold)
    if (!best) {
      for (const l of localPool) {
        if (l._matched) continue;
        if (l.broker !== aBroker) continue;
        if (l.category !== aCat) continue;
        const d = Math.abs((l.grossRON || 0) - aGross);
        const denom = Math.max(Math.abs(l.grossRON || 0), Math.abs(aGross), 1);
        if (d <= NEAR_ABS || d / denom <= NEAR_REL) {
          best = l; bestStatus = 'matched-amount'; bestDelta = d; break;
        }
      }
    }
    // Pass 3: possible (same category, broker not identified or different broker)
    if (!best) {
      for (const l of localPool) {
        if (l._matched) continue;
        if (l.category !== aCat) continue;
        const d = Math.abs((l.grossRON || 0) - aGross);
        const denom = Math.max(Math.abs(l.grossRON || 0), Math.abs(aGross), 1);
        if (d <= NEAR_ABS || d / denom <= NEAR_REL) {
          best = l; bestStatus = 'possible'; bestDelta = d; break;
        }
      }
    }

    if (best) {
      best._matched = true;
      matches.push({
        anaf: { ...a, broker: aBroker },
        local: best,
        status: bestStatus,
        delta: bestDelta,
        hint: bestStatus === 'matched-exact'
          ? null
          : bestStatus === 'matched-amount'
            ? `Diferență mică (~${Math.round(bestDelta)} RON) — probabil rotunjire.`
            : `Posibil match prin categorie + sumă, dar plătitorul nu a putut fi identificat sigur. Verifică.`,
      });
    } else {
      matches.push({
        anaf: { ...a, broker: aBroker },
        local: null,
        status: 'unmatched-anaf',
        delta: null,
        hint: `ANAF a primit D205 de la "${a.payerName}" pentru ${getCategory(aCat) ? getCategory(aCat).label : 'categorie ' + aCat} (${aGross.toLocaleString('ro-RO')} RON), dar nu avem PDF / date locale pentru această sumă. Importă documentul broker/banca corespunzător sau adaugă-l în „Adaugă date".`,
      });
    }
  }

  // Unmatched local rows fall into two buckets:
  //   - foreignSource: true   → expected to NOT appear in D205 (e.g. foreign
  //     dividends via a Romanian broker; payer is the foreign issuer, not
  //     the intermediary). Marked with status 'expected-not-in-d205' so the
  //     UI doesn't alarm the user.
  //   - everything else        → status 'unmatched-local' (possible missing
  //     D205 from the payer, or a document type the matcher doesn't yet know
  //     how to map to a D205 category).
  const unmatchedLocal = localPool.filter((l) => !l._matched).map(({ _idx, _matched, ...rest }) => {
    if (rest.foreignSource) {
      return {
        ...rest,
        status: 'expected-not-in-d205',
        hint: `Venit din surse externe via broker român (${rest.broker} · ${rest.label} · ${Math.round(rest.grossRON || 0).toLocaleString('ro-RO')} RON). NU apare la ANAF în D205 — plătitorul real e emitentul străin, nu intermediarul român. Se declară separat ca venit din străinătate (D212 cap14).`,
      };
    }
    return {
      ...rest,
      status: 'unmatched-local',
      hint: `Avem date locale (${rest.broker} · ${rest.label} · ${Math.round(rest.grossRON || 0).toLocaleString('ro-RO')} RON) dar ANAF nu primește D205 corespunzător. Probabil plătitorul nu a depus încă D205, sau ai un document care nu se traduce într-o D205 (ex. broker străin, fără retenție RO).`,
    };
  });

  const totals = {
    exactCount: matches.filter((m) => m.status === 'matched-exact').length,
    nearCount: matches.filter((m) => m.status === 'matched-amount').length,
    possibleCount: matches.filter((m) => m.status === 'possible').length,
    unmatchedAnafCount: matches.filter((m) => m.status === 'unmatched-anaf').length,
    unmatchedLocalCount: unmatchedLocal.filter((l) => l.status === 'unmatched-local').length,
    expectedNotInD205Count: unmatchedLocal.filter((l) => l.status === 'expected-not-in-d205').length,
  };

  return { matches, unmatchedLocal, totals };
}

module.exports = {
  buildLocalBreakdown,
  matchD205,
  identifyBroker,
  normPayerName,
};
