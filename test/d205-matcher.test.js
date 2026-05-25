/**
 * Unit tests for lib/d205-matcher.js — payer-level D205 cross-checking.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildLocalBreakdown,
  matchD205,
  identifyBroker,
  normPayerName,
} = require('../lib/d205-matcher');

// ---------- normPayerName + identifyBroker ----------

test('normPayerName strips accents, suffixes, case', () => {
  assert.equal(normPayerName('XTB S.A. Varsovia Sucursala București'), 'xtb');
  assert.equal(normPayerName('ING BANK N.V. AMSTERDAM SUCURSALA BUCUREȘTI'), 'ing bank');
  assert.equal(normPayerName('SALT BANK SA'), 'salt bank');
});

test('identifyBroker maps known payer name fingerprints', () => {
  assert.equal(identifyBroker('XTB S.A. Varsovia Sucursala Bucuresti'), 'XTB');
  assert.equal(identifyBroker('BT Capital Partners'), 'BT Capital Partners');
  assert.equal(identifyBroker('SALT BANK SA'), 'SALT Bank');
  assert.equal(identifyBroker('ING BANK N.V. AMSTERDAM SUCURSALA BUCURESTI'), 'ING Bank');
  assert.equal(identifyBroker('Goldring SA'), 'Goldring');
});

test('identifyBroker returns null for unknown payers', () => {
  assert.equal(identifyBroker('Brokeraj Necunoscut SRL'), null);
  assert.equal(identifyBroker(''), null);
  assert.equal(identifyBroker(null), null);
});

// ---------- buildLocalBreakdown ----------

test('buildLocalBreakdown turns XTB dividends + interest into 2 entries', () => {
  const yd = {
    xtbDividendsReport: {
      dividends: { grossRON: 1000, taxWithheldRON: 100 },
      interest: { grossRON: 300, taxWithheldRON: 30 },
    },
  };
  const r = buildLocalBreakdown(yd);
  assert.equal(r.length, 2);
  assert.equal(r[0].broker, 'XTB');
  assert.equal(r[0].category, '20');
  assert.equal(r[0].grossRON, 1000);
  assert.equal(r[1].category, '09');
});

test('buildLocalBreakdown emits separate long/short capgains for XTB Portfolio', () => {
  const yd = {
    xtbPortfolio: {
      countries: [
        { longGainRON: 500, longTaxRON: 5, shortGainRON: 1000, shortTaxRON: 30 },
        { longGainRON: 200, longTaxRON: 2, shortGainRON: 0, shortTaxRON: 0 },
      ],
    },
  };
  const r = buildLocalBreakdown(yd);
  const long = r.find((x) => x.category === '26');
  const short = r.find((x) => x.category === '27');
  assert.ok(long);
  assert.equal(long.grossRON, 700);
  assert.equal(long.taxRON, 7);
  assert.ok(short);
  assert.equal(short.grossRON, 1000);
  assert.equal(short.taxRON, 30);
});

test('buildLocalBreakdown empty input returns []', () => {
  assert.deepEqual(buildLocalBreakdown(null), []);
  assert.deepEqual(buildLocalBreakdown(undefined), []);
  assert.deepEqual(buildLocalBreakdown({}), []);
});

// ---------- matchD205 ----------

test('matchD205: exact match on broker + category + amount', () => {
  const yd = {
    xtbDividendsReport: { dividends: { grossRON: 1000, taxWithheldRON: 100 } },
  };
  const d205 = [{ payerName: 'XTB SA Varsovia', category: '20', grossRON: 1000, taxRON: 100 }];
  const r = matchD205(d205, yd);
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].status, 'matched-exact');
  assert.equal(r.totals.exactCount, 1);
  assert.equal(r.totals.unmatchedAnafCount, 0);
  assert.equal(r.totals.unmatchedLocalCount, 0);
});

test('matchD205: near match (rounding) on broker + category', () => {
  const yd = {
    xtbDividendsReport: { dividends: { grossRON: 1000, taxWithheldRON: 100 } },
  };
  const d205 = [{ payerName: 'XTB SA', category: '20', grossRON: 1002 }];
  const r = matchD205(d205, yd);
  assert.equal(r.matches[0].status, 'matched-amount');
  assert.match(r.matches[0].hint, /rotunjire/i);
});

test('matchD205: unmatched-anaf when no local source covers an entry', () => {
  const yd = {};
  const d205 = [{ payerName: 'SALT BANK SA', category: '09', grossRON: 7 }];
  const r = matchD205(d205, yd);
  assert.equal(r.matches[0].status, 'unmatched-anaf');
  assert.equal(r.totals.unmatchedAnafCount, 1);
  assert.match(r.matches[0].hint, /SALT BANK/);
});

test('matchD205: foreign-source dividends via RO broker → expected-not-in-d205', () => {
  // XTB dividends are foreign-source income (US-issuer, etc.). They DO NOT
  // appear in D205 because the payer is the foreign issuer, not the
  // Romanian intermediary. Matcher must classify them as
  // 'expected-not-in-d205' (informational), not 'unmatched-local'.
  const yd = {
    xtbDividendsReport: { dividends: { grossRON: 1000, taxWithheldRON: 100 } },
  };
  const r = matchD205([], yd);
  assert.equal(r.unmatchedLocal.length, 1);
  assert.equal(r.unmatchedLocal[0].broker, 'XTB');
  assert.equal(r.unmatchedLocal[0].status, 'expected-not-in-d205');
  assert.equal(r.totals.unmatchedLocalCount, 0);
  assert.equal(r.totals.expectedNotInD205Count, 1);
});

test('matchD205: capgains use GROSS gain (not net of losses) to match D205', () => {
  // ANAF D205 cat 27 reports the GROSS short-term gain — broker withholds
  // tax per profitable trade, not on the year's net. If a user has 427094
  // gross gain + 37699 losses (net 389395), the local breakdown row that
  // maps to D205 must be 427094, not 389395.
  const yd = {
    xtbPortfolio: {
      countries: [
        { shortGainRON: 427094, shortLossRON: 37699, shortTaxRON: 12812 },
      ],
    },
  };
  const d205 = [
    { payerName: 'Xtb SA Varsovia Sucursala Bucuresti', category: '27', grossRON: 427095, taxRON: 12812 },
  ];
  const r = matchD205(d205, yd);
  // 1 RON diff vs ANAF's 427095 — rounding, well under MATCH_EPS.
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].status, 'matched-exact');
});

test('matchD205: BT Capital Partners portfolio is included in local breakdown', () => {
  // Regression: an earlier matcher version only iterated XTB + Tradeville,
  // leaving BT Capital Partners portfolio rows invisible to the match.
  const yd = {
    btPortfolio: {
      countries: [
        { shortGainRON: 84151, shortLossRON: 23748, shortTaxRON: 2526 },
      ],
    },
  };
  const d205 = [
    { payerName: 'BT Capital Partners', category: '27', grossRON: 84151, taxRON: 2526 },
  ];
  const r = matchD205(d205, yd);
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].status, 'matched-exact');
  assert.equal(r.matches[0].local.broker, 'BT Capital Partners');
});

test('matchD205: same payer, multiple categories tracked independently', () => {
  // XTB filed two D205s: dividends + capgains short. We have both locally.
  const yd = {
    xtbDividendsReport: { dividends: { grossRON: 1000, taxWithheldRON: 100 } },
    xtbPortfolio: { countries: [{ shortGainRON: 5000, shortTaxRON: 150 }] },
  };
  const d205 = [
    { payerName: 'XTB SA', category: '20', grossRON: 1000 },
    { payerName: 'XTB SA', category: '27', grossRON: 5000 },
  ];
  const r = matchD205(d205, yd);
  assert.equal(r.totals.exactCount, 2);
  assert.equal(r.totals.unmatchedAnafCount, 0);
  assert.equal(r.totals.unmatchedLocalCount, 0);
});

test('matchD205: a local pool entry is only matched once', () => {
  // Two D205s claim to be the same XTB dividends — only the first matches.
  const yd = {
    xtbDividendsReport: { dividends: { grossRON: 1000, taxWithheldRON: 100 } },
  };
  const d205 = [
    { payerName: 'XTB SA', category: '20', grossRON: 1000 },
    { payerName: 'XTB SA', category: '20', grossRON: 1000 },
  ];
  const r = matchD205(d205, yd);
  assert.equal(r.matches[0].status, 'matched-exact');
  assert.equal(r.matches[1].status, 'unmatched-anaf');
});

test('matchD205: unknown broker fingerprint falls back to possible match by category+amount', () => {
  const yd = {
    xtbDividendsReport: { dividends: { grossRON: 100, taxWithheldRON: 10 } },
  };
  // Unknown payer name, but same category and amount → 'possible'.
  const d205 = [{ payerName: 'Brokeraj Misterios SRL', category: '20', grossRON: 100 }];
  const r = matchD205(d205, yd);
  assert.equal(r.matches[0].status, 'possible');
  assert.match(r.matches[0].hint, /pl[aă]titorul nu a putut fi identificat/i);
});

test('matchD205: identified broker but wrong category → unmatched-anaf', () => {
  // XTB filed for capgains but locally we only have dividends.
  const yd = {
    xtbDividendsReport: { dividends: { grossRON: 1000, taxWithheldRON: 100 } },
  };
  const d205 = [{ payerName: 'XTB SA', category: '27', grossRON: 5000 }];
  const r = matchD205(d205, yd);
  // The amount doesn't match any local entry within thresholds → unmatched-anaf
  assert.equal(r.matches[0].status, 'unmatched-anaf');
});
