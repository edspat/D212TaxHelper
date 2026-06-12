/**
 * Unit tests for lib/d212-cap11.js — D212 cap11 row builder.
 *
 * The cap11 element is the Romanian-source income block of D212. These tests
 * exercise the rules that the form's PDF tool enforces silently (Rd.6 formula,
 * Schematron BR-D212-0085 uniqueness, conditional emission).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCap11Rows } = require('../lib/d212-cap11');

test('empty input → zero rows (no RO broker activity)', () => {
  assert.deepEqual(buildCap11Rows({}), []);
  assert.deepEqual(buildCap11Rows({ roLongTermGainRON: 0, roShortTermGainRON: 0 }), []);
});

test('XTB-only gain, no losses → single row with code 1012', () => {
  const rows = buildCap11Rows({
    roLongTermGainRON: 10000,
    roShortTermGainRON: 5000,
    roCapitalGainsTax: 10000 * 0.01 + 5000 * 0.03, // 1% + 3% = 250
    roPortTaxWithheld: 250,
  });
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.categ_venit, '1012');
  assert.equal(r.venit_brut, 15000);
  assert.equal(r.chelt_deduc, 0);
  assert.equal(r.venit_net_anual, 15000);
  assert.equal(r.pierdere, 0);
  assert.equal(r.pierdere_precedenta, 0);
  assert.equal(r.pierdere_compensata, 0);
  assert.equal(r.venit_recalculat, 15000);
  assert.equal(r.impozit11, 250);
  assert.equal(r.impozit_retinut, 250);
});

test('XTB gain with prior loss carryforward — Rd.6 = min(Rd.5, 0.70 × Rd.3)', () => {
  // Prior loss exceeds 70% cap → cap should kick in.
  const rows = buildCap11Rows({
    roLongTermGainRON: 8000,
    roShortTermGainRON: 2000,             // totalGain = 10000
    priorLossesAvailable: 9000,           // available > cap
    priorLossesApplied: 7000,             // = 0.70 × 10000 (caller already capped)
    roCapitalGainsTax: 30,                // computed by caller on after-loss buckets
    roPortTaxWithheld: 100,
  });
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.venit_brut, 10000);
  assert.equal(r.pierdere_precedenta, 9000);
  assert.equal(r.pierdere_compensata, 7000);
  assert.equal(r.venit_recalculat, 3000); // 10000 - 7000
  assert.equal(r.impozit11, 30);
  assert.equal(r.impozit_retinut, 100);
});

test('cross-bucket loss surfaces as Rd.4 = currentYearLossRON', () => {
  // Long bucket netted to 0 (post Math.max), short bucket has +5000 gain.
  // Cross-bucket residual loss of 3000 carries forward.
  const rows = buildCap11Rows({
    roLongTermGainRON: 0,
    roShortTermGainRON: 5000,
    currentYearLossRON: 3000,
    roCapitalGainsTax: 150, // 3% × 5000
    roPortTaxWithheld: 150,
  });
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.venit_brut, 5000);
  assert.equal(r.pierdere, 3000);   // Rd.4 carries forward
  assert.equal(r.impozit11, 150);
  assert.equal(r.impozit_retinut, 150);
});

test('only loss (no gain) → row still emitted to carry forward Rd.4', () => {
  // No gains this year, but a loss to carry forward. cap11 must still appear
  // so next year's pierdere_precedenta can be populated.
  const rows = buildCap11Rows({
    currentYearLossRON: 2500,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].venit_brut, 0);
  assert.equal(rows[0].pierdere, 2500);
  assert.equal(rows[0].impozit11, 0);
});

test('over-withholding (impozit_retinut > impozit11) surfaces refund signal', () => {
  // Broker over-withheld vs. the recomputed Rd.8. The XML emitter / refund
  // detector reads impozit_retinut - impozit11 to populate the refund row.
  const rows = buildCap11Rows({
    roLongTermGainRON: 1000,
    roShortTermGainRON: 0,
    roCapitalGainsTax: 10,    // 1% × 1000
    roPortTaxWithheld: 50,    // broker took 5% by mistake
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].impozit11, 10);
  assert.equal(rows[0].impozit_retinut, 50);
  assert.equal(rows[0].impozit_retinut - rows[0].impozit11, 40); // refund signal
});

test('row carries categ_venit=1012 to satisfy schematron CD-D212-015', () => {
  // The schematron rule restricts categ_venit to a hardcoded list including
  // '1012'. Regression test: do not emit a numeric or a different code.
  const rows = buildCap11Rows({
    roLongTermGainRON: 100,
    roShortTermGainRON: 0,
    roCapitalGainsTax: 1,
    roPortTaxWithheld: 1,
  });
  assert.equal(typeof rows[0].categ_venit, 'string');
  assert.equal(rows[0].categ_venit, '1012');
});

test('only prior losses (no current activity) → row emitted to preserve carryforward', () => {
  // Edge case: user has a 5000 RON prior-year loss but didn't trade this year.
  // We still emit the row so Rd.5 stays declared (the loss continues to expire
  // on its 7-year clock per Cod fiscal art. 119).
  const rows = buildCap11Rows({
    priorLossesAvailable: 5000,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pierdere_precedenta, 5000);
  assert.equal(rows[0].pierdere_compensata, 0);
  assert.equal(rows[0].venit_brut, 0);
});
