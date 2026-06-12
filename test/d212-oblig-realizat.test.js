/**
 * Unit tests for lib/d212-oblig-realizat.js — D212 <oblig_realizat> builder
 * for investment income (CASS + global summary).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildObligRealizat } = require('../lib/d212-oblig-realizat');

test('empty / null / no income → returns null (block skipped)', () => {
  assert.equal(buildObligRealizat(null), null);
  assert.equal(buildObligRealizat({}), null);
  assert.equal(buildObligRealizat({ totalIncome_cass: 0, cassInfo: { applies: false }, incomeTaxOnly: 0, refundOwedRON: 0 }), null);
});

test('investment income below CASS threshold (< 6 SM) → no CASS, but income tax still surfaces', () => {
  // 2025: min salary = 4050, 6 SM = 24300. Income of 10000 is below threshold.
  // Income tax (8% on dividends) still produces an obligation.
  const data = {
    totalIncome_cass: 10000,
    cassInfo: { applies: false, base: 0, amount: 0 },
    incomeTaxOnly: 800,
    refundOwedRON: 0,
  };
  const r = buildObligRealizat(data);
  assert.ok(r);
  assert.equal(r.cass_ven_inv, 10000);
  assert.equal(r.cass_baza, 0);
  assert.equal(r.cass_anuala, 0);
  assert.equal(r.cass_datorat, 0);
  assert.equal(r.cass_plus, 0);
  assert.equal(r.impozit_venit_plus, 800);
  assert.equal(r.dif_de_plata, 800);
  assert.equal(r.dif_de_restituit, 0);
});

test('CASS at 6-12 SM tier — base capped at 6 SM (24300 in 2025)', () => {
  const data = {
    totalIncome_cass: 30000,                                // between 6 and 12 SM
    cassInfo: { applies: true, base: 24300, amount: 2430 },  // 6 SM × 10%
    incomeTaxOnly: 3000,
    refundOwedRON: 0,
  };
  const r = buildObligRealizat(data);
  assert.equal(r.cass_baza, 24300);
  assert.equal(r.cass_anuala, 2430);
  assert.equal(r.cass_datorat, 2430);
  assert.equal(r.cass_plus, 2430);
  assert.equal(r.dif_de_plata, 5430); // 3000 + 2430
});

test('CASS > 24 SM (max for investment) — base capped at 24 SM = 97200 in 2025', () => {
  // Scenario: a user with ~500k RON of investment income (synthetic round
  // number, not corresponding to any real taxpayer) hits the >24 SM tier,
  // so the CASS base maxes out at 24 × 4050 = 97200 RON and CASS = 9720.
  // The 97200 / 9720 figures are mathematically derived from the public
  // 2025 minimum salary; only the input total is illustrative.
  const data = {
    totalIncome_cass: 500000,
    cassInfo: { applies: true, base: 97200, amount: 9720 },
    incomeTaxOnly: 5000,
    refundOwedRON: 0,
  };
  const r = buildObligRealizat(data);
  assert.equal(r.cass_ven_inv, 500000);
  assert.equal(r.cass_total_ven, 500000);
  assert.equal(r.venit_ret_inv, 500000);
  assert.equal(r.cass_baza, 97200);
  assert.equal(r.cass_anuala, 9720);
  assert.equal(r.cass_datorat, 9720);
  assert.equal(r.cass_dif_plus, 9720);
  assert.equal(r.cass_plus, 9720);
  assert.equal(r.dif_de_plata, 5000 + 9720);
});

test('over-withholding → refund surfaces as impozit_venit_minus + dif_de_restituit', () => {
  // Broker withheld 1644 RON more than the recomputed income tax.
  const data = {
    totalIncome_cass: 50000,
    cassInfo: { applies: true, base: 24300, amount: 2430 },
    incomeTaxOnly: 1500,
    refundOwedRON: 1644,
  };
  const r = buildObligRealizat(data);
  assert.equal(r.impozit_venit_plus, 1500);
  assert.equal(r.impozit_venit_minus, 1644);
  assert.equal(r.cass_plus, 2430);
  assert.equal(r.cass_minus, 0);
  assert.equal(r.dif_de_plata, 1500 + 2430);     // 3930
  assert.equal(r.dif_de_restituit, 1644);
});

test('bifa_cass_real defaults to "3" (real system, capped at 24 SM)', () => {
  const r = buildObligRealizat({
    totalIncome_cass: 100000,
    cassInfo: { applies: true, base: 97200, amount: 9720 },
  });
  assert.equal(r.bifa_cass_real, '3');
});

test('AI/DPI/CFB-specific attributes are not present in our emission', () => {
  // We don't compute PFA / drepturi proprietate / chirii data. The keys must
  // be absent from the output so the XML emitter doesn't include them.
  const r = buildObligRealizat({
    totalIncome_cass: 100000,
    cassInfo: { applies: true, base: 97200, amount: 9720 },
    incomeTaxOnly: 5000,
  });
  // These belong to PFA / DPI; our investment-only emission excludes them.
  for (const k of [
    'cass_total_ven_ai', 'baza_cass_datorat_ai', 'cass_anuala_ai',
    'cass_datorat_ai', 'real_venit_net_recalculat_ai', 'real_impozit_datorat_ai',
    'oblimpoz_real_total', 'oblimpoz_real_dif_deplata',
    'oblcass_real_difPlus_dpi', 'oblcass_real_difPlus_ai',
  ]) {
    assert.equal(Object.prototype.hasOwnProperty.call(r, k), false, `${k} should NOT be set`);
  }
});

test('zero-investment helpers populated (cass_ven_dpi/asc/cfb/asp/alt = 0)', () => {
  // The donor XML emits these as 0 explicitly. Mirror that style for
  // structural parity with the DUF output.
  const r = buildObligRealizat({
    totalIncome_cass: 100000,
    cassInfo: { applies: true, base: 97200, amount: 9720 },
  });
  assert.equal(r.cass_ven_dpi, 0);
  assert.equal(r.cass_ven_asc, 0);
  assert.equal(r.cass_ven_cfb, 0);
  assert.equal(r.cass_ven_asp, 0);
  assert.equal(r.cass_ven_alt, 0);
});
