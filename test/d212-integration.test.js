/**
 * D212 end-to-end integration tests (P5).
 *
 * Each scenario builds a realistic `yd` (year data) object as if it came
 * out of the parsers + Add Data form, runs it through the canonical lib
 * pipeline (income-resolvers → cap-row builders), and asserts on:
 *   - aggregate income (gross + tax withheld)
 *   - cap11Rows / cap14Rows shape and amounts
 *   - dividend tax due / refund detection
 *   - CASS base
 *
 * The "connector" logic between resolvers and cap-row builders that lives
 * inline in `public/js/app.js: _computeYearDataImpl` is reproduced here in
 * compact helper closures so the test asserts the SAME formula. If the
 * inline mirror in app.js diverges, these tests catch it indirectly via
 * the cap-row builder calls; the explicit helpers double as documentation.
 *
 * These tests are deliberately scenario-driven (one test per realistic
 * user profile) rather than per-helper. Per-helper unit tests already
 * exist in test/income-resolvers.test.js, test/d212-cap11.test.js,
 * test/d212-cap14.test.js, test/rates.test.js etc.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Resolvers = require('../lib/income-resolvers');
const { buildCap11Rows } = require('../lib/d212-cap11');
const { buildCap14Rows } = require('../lib/d212-cap14');
const { BNR_EXCHANGE_RATES } = require('../lib/rates');

// Compact connector functions mirroring _computeYearDataImpl. These are
// pure functions of resolver outputs; they exist here for clarity but
// must match the inline implementation in public/js/app.js exactly.
// If app.js changes its tax aggregation formula, update both sides.
function aggregateDividendTax({ resUsDiv, resRoDiv, divTaxRate }) {
  const usForeignTaxRON = resUsDiv.foreignTaxRON || 0;
  const usDivTaxDueRON = (resUsDiv.grossRON || 0) * divTaxRate;
  const usDivCreditRON = Math.min(usDivTaxDueRON, usForeignTaxRON);
  const usDivTax = Math.max(0, usDivTaxDueRON - usDivCreditRON);

  const roDivLocalTaxBaseRON = (resRoDiv.localGrossRON || 0) + (resRoDiv.unknownCountryRON || 0);
  const roDivLocalTaxDue = roDivLocalTaxBaseRON * divTaxRate;
  const roDivLocalTaxWithheldEffective =
    (resRoDiv.localTaxWithheldRON || 0) + (resRoDiv.unknownCountryTaxRON || 0);
  const roDivLocalTaxNet = Math.max(0, roDivLocalTaxDue - roDivLocalTaxWithheldEffective);

  let roDivForeignTaxNet = 0;
  let roDivForeignTaxCredit = 0;
  let roDivForeignTaxDue = 0;
  for (const c of resRoDiv.foreignByCountry || []) {
    const Rd8 = (c.grossRON || 0) * divTaxRate;
    const Rd10 = Math.min(Rd8, c.taxRON || 0);
    roDivForeignTaxDue += Rd8;
    roDivForeignTaxCredit += Rd10;
    roDivForeignTaxNet += Math.max(0, Rd8 - Rd10);
  }

  const dividendTaxRON = usDivTax + roDivLocalTaxNet + roDivForeignTaxNet;
  return {
    usDivTax,
    roDivLocalTaxDue,
    roDivLocalTaxNet,
    roDivForeignTaxDue,
    roDivForeignTaxCredit,
    roDivForeignTaxNet,
    dividendTaxRON,
    roDivLocalTaxWithheldEffective,
  };
}

function detectRefunds({ roPortTaxWithheld, roCapitalGainsTax, divTaxAgg, interestTaxPaid, interestTaxGross }) {
  const roCapGainsOverwithheld = Math.max(0, (roPortTaxWithheld || 0) - (roCapitalGainsTax || 0));
  const roDivOverwithheld = Math.max(
    0,
    (divTaxAgg.roDivLocalTaxWithheldEffective || 0) - (divTaxAgg.roDivLocalTaxDue || 0)
  );
  const interestOverwithheld = Math.max(0, (interestTaxPaid || 0) - (interestTaxGross || 0));
  return {
    roCapGainsOverwithheld,
    roDivOverwithheld,
    interestOverwithheld,
    refundOwedRON: roCapGainsOverwithheld + roDivOverwithheld + interestOverwithheld,
  };
}

// =========================================================================
// SCENARIO 1: Romanian-source only (Tradeville + RO dividends via TLV depo)
// =========================================================================
test('integration: RO-only user (Tradeville stocks, no foreign exposure)', () => {
  const year = 2025;
  const rates = BNR_EXCHANGE_RATES[year];
  const yd = {
    tradevillePortfolio: {
      longTerm: { gainRON: 5000, lossRON: 0, taxWithheldRON: 50 },
      shortTerm: { gainRON: 8000, lossRON: 1500, taxWithheldRON: 240 },
      totalTaxWithheldRON: 290,
      countries: [
        { country: 'ROMANIA', currency: 'RON', longGainRON: 5000, longLossRON: 0, longTaxRON: 50,
          shortGainRON: 8000, shortLossRON: 1500, shortTaxRON: 240 },
      ],
    },
  };
  const ctx = { usdRate: rates.usdRon, eurRate: rates.eurRon, year };
  const resUsDiv = Resolvers.resolveUsDividends(yd, ctx);
  const resRoDiv = Resolvers.resolveRoBrokerDividends(yd, ctx);
  const resRoCG = Resolvers.resolveRoBrokerGains(yd, ctx);

  // No foreign income.
  assert.equal(resUsDiv.grossRON, 0);
  assert.equal(resRoDiv.grossRON, 0);

  // RO gains aggregated by tier — resolver returns NET (gain - loss).
  // The GROSS (per-trade gains only) is used by D205 matcher, not here.
  assert.equal(resRoCG.longGainRON, 5000);
  assert.equal(resRoCG.shortGainRON, 6500); // 8000 - 1500 (NET)
  assert.equal(resRoCG.totalGainRON, 11500);
  assert.equal(resRoCG.taxWithheldRON, 290); // 50 + 240
  assert.equal(resRoCG.currentYearLossRON, 0); // net positive, no carry-forward

  // cap11 row aggregated (categ_venit=1012).
  const roLongRate = 0.01;
  const roShortRate = 0.03;
  const roCapitalGainsTax = 5000 * roLongRate + 6500 * roShortRate; // 50 + 195 = 245
  const cap11Rows = buildCap11Rows({
    roLongTermGainRON: 5000,
    roShortTermGainRON: 6500,
    currentYearLossRON: resRoCG.currentYearLossRON,
    roCapitalGainsTax,
    roPortTaxWithheld: 290,
  });
  assert.equal(cap11Rows.length, 1);
  assert.equal(cap11Rows[0].categ_venit, '1012');
  assert.equal(cap11Rows[0].venit_brut, 11500);
  assert.equal(cap11Rows[0].impozit11, 245);
  assert.equal(cap11Rows[0].impozit_retinut, 290);
  // Broker over-withheld (290 actual vs 245 due) → 45 RON refund.

  // cap14 empty (no foreign income).
  const cap14Rows = buildCap14Rows({
    divTaxRate: 0.08,
    capGainsTaxRate: 0.10,
  });
  assert.equal(cap14Rows.length, 0);

  // No refund.
  const divTaxAgg = aggregateDividendTax({ resUsDiv, resRoDiv, divTaxRate: 0.08 });
  const refunds = detectRefunds({
    roPortTaxWithheld: 290,
    roCapitalGainsTax,
    divTaxAgg,
    interestTaxPaid: 0,
    interestTaxGross: 0,
  });
  // Broker withheld 290 but only 245 is due → refund 45 RON.
  assert.equal(refunds.roCapGainsOverwithheld, 45);
  assert.equal(refunds.refundOwedRON, 45);
});

// =========================================================================
// SCENARIO 2: US-only user (Fidelity RSU sale + 1042-S dividends, W-8BEN 10%)
// =========================================================================
test('integration: US-only user (Fidelity + 1042-S, W-8BEN 10% WHT)', () => {
  const year = 2025;
  const rates = BNR_EXCHANGE_RATES[year];
  const yd = {
    form1042s: [
      { incomeCode: '06', grossIncomeUSD: 500, federalTaxWithheldUSD: 50 }, // 10% WHT
    ],
  };
  const ctx = { usdRate: rates.usdRon, eurRate: rates.eurRon, year };
  const resUsDiv = Resolvers.resolveUsDividends(yd, ctx);

  // 1042-S contributes to US gross + foreign tax.
  assert.equal(Math.round(resUsDiv.grossUSD), 500);
  assert.equal(Math.round(resUsDiv.foreignTaxUSD), 50);
  assert.ok(Math.abs(resUsDiv.grossRON - 500 * rates.usdRon) < 0.5);
  assert.ok(Math.abs(resUsDiv.foreignTaxRON - 50 * rates.usdRon) < 0.5);

  // cap14 US:2018 row with 8% RO tax due, 10% foreign tax → credit capped at 8%.
  const cap14Rows = buildCap14Rows({
    dividendsRON: resUsDiv.grossRON,
    usDivForeignTaxRON: resUsDiv.foreignTaxRON,
    divTaxRate: 0.08,
    capGainsTaxRate: 0.10,
  });
  const usDiv = cap14Rows.find(r => r.str_categ_venit === '2018' && r.str_stat_realiz_v === 'US');
  assert.ok(usDiv);
  const expectedGross = Math.round(500 * rates.usdRon);
  const expectedRoTaxDue = Math.round(expectedGross * 0.08);
  const expectedForeignTax = Math.round(50 * rates.usdRon);
  // Credit fiscal capped at RO tax due (8% < 10% withheld).
  assert.equal(usDiv.str_venit_brut, expectedGross);
  assert.equal(usDiv.str_impozit_datorat_Ro, expectedRoTaxDue);
  assert.equal(usDiv.str_impozit_platit, expectedForeignTax);
  assert.equal(usDiv.str_credit_fiscal, Math.min(expectedRoTaxDue, expectedForeignTax));
  // User pays 0 (credit covers full RO tax due — confirmed in user testing 2026-05-25).
  assert.equal(usDiv.str_dif_impozit_datorat, 0);
});

// =========================================================================
// SCENARIO 3: Mixed user (XTB foreign divs + BT portfolio + Fidelity 1042-S)
// =========================================================================
test('integration: mixed RO+foreign user (XTB+BT+Fidelity)', () => {
  const year = 2025;
  const rates = BNR_EXCHANGE_RATES[year];
  const yd = {
    // XTB foreign dividends (US + DE)
    xtbDividendsReport: {
      year,
      dividends: { grossRON: 1417, taxWithheldRON: 142 },
      dividendsByCountry: [
        { country: 'US', isRomanian: false, grossRON: 1000, taxRON: 100, netRON: 900 },
        { country: 'DE', isRomanian: false, grossRON: 417, taxRON: 42, netRON: 375 },
      ],
    },
    // BT Capital Partners portfolio + dividends (no RO source)
    btDividendsReport: {
      year,
      dividends: { grossRON: 2329, taxWithheldRON: 233 },
      dividendsByCountry: [
        { country: 'US', isRomanian: false, grossRON: 1500, taxRON: 150, netRON: 1350 },
        { country: 'NL', isRomanian: false, grossRON: 829, taxRON: 83, netRON: 746 },
      ],
    },
    btPortfolio: {
      longTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
      shortTerm: { gainRON: 84151, lossRON: 0, taxWithheldRON: 2526 },
      totalTaxWithheldRON: 2526,
      countries: [
        { country: 'GERMANIA / XETRA', currency: 'RON',
          longGainRON: 0, longLossRON: 0, longTaxRON: 0,
          shortGainRON: 84151, shortLossRON: 0, shortTaxRON: 2526 },
      ],
    },
    // Fidelity 1042-S US dividends
    form1042s: [
      { incomeCode: '06', grossIncomeUSD: 200, federalTaxWithheldUSD: 20 },
    ],
  };
  const ctx = { usdRate: rates.usdRon, eurRate: rates.eurRon, year };
  const resUsDiv = Resolvers.resolveUsDividends(yd, ctx);
  const resRoDiv = Resolvers.resolveRoBrokerDividends(yd, ctx);
  const resRoCG = Resolvers.resolveRoBrokerGains(yd, ctx);

  // Foreign dividends split by country (XTB+BT merged).
  const us = resRoDiv.foreignByCountry.find(c => c.country === 'US');
  const de = resRoDiv.foreignByCountry.find(c => c.country === 'DE');
  const nl = resRoDiv.foreignByCountry.find(c => c.country === 'NL');
  assert.equal(us.grossRON, 2500);  // 1000 XTB + 1500 BT
  assert.equal(us.taxRON, 250);
  assert.equal(us.sources.length, 2);
  assert.equal(de.grossRON, 417);
  assert.equal(nl.grossRON, 829);
  assert.equal(resRoDiv.localGrossRON, 0);

  // cap14: US row merges Fidelity 1042-S + XTB US + BT US = 3 sources, 1 row.
  const cap14Rows = buildCap14Rows({
    dividendsRON: resUsDiv.grossRON,
    usDivForeignTaxRON: resUsDiv.foreignTaxRON,
    roBrokerForeignDividendsByCountry: resRoDiv.foreignByCountry,
    divTaxRate: 0.08,
    capGainsTaxRate: 0.10,
  });
  const usDivRow = cap14Rows.find(r => r.str_categ_venit === '2018' && r.str_stat_realiz_v === 'US');
  const deDivRow = cap14Rows.find(r => r.str_categ_venit === '2018' && r.str_stat_realiz_v === 'DE');
  const nlDivRow = cap14Rows.find(r => r.str_categ_venit === '2018' && r.str_stat_realiz_v === 'NL');
  assert.ok(usDivRow);
  assert.ok(deDivRow);
  assert.ok(nlDivRow);
  // US merged: 200 USD × rate ≈ 894 RON Fidelity + 2500 XTB+BT = ~3394 RON
  const expectedUsGross = Math.round(200 * rates.usdRon + 2500);
  assert.equal(usDivRow.str_venit_brut, expectedUsGross);
  // Only one US row (no duplicates).
  const usCount = cap14Rows.filter(r => r.str_categ_venit === '2018' && r.str_stat_realiz_v === 'US').length;
  assert.equal(usCount, 1);

  // BT short-term gain (cap11 captures it).
  // Resolver gives NET (gain - loss); here loss=0 so net=gross=84151.
  assert.equal(resRoCG.shortGainRON, 84151);
  assert.equal(resRoCG.taxWithheldRON, 2526);
  const cap11Rows = buildCap11Rows({
    roLongTermGainRON: resRoCG.longGainRON,
    roShortTermGainRON: resRoCG.shortGainRON,
    roCapitalGainsTax: 84151 * 0.03,
    roPortTaxWithheld: 2526,
  });
  assert.equal(cap11Rows.length, 1);
  assert.equal(cap11Rows[0].venit_brut, 84151);

  // No meaningful refund — credit caps at 8%, foreign overpayment lost.
  // (Broker rounding produces ~1.5 RON refund on the capgains side, which
  // is realistic but not a fiscal concern.)
  const divTaxAgg = aggregateDividendTax({ resUsDiv, resRoDiv, divTaxRate: 0.08 });
  const refunds = detectRefunds({
    roPortTaxWithheld: 2526,
    roCapitalGainsTax: 84151 * 0.03,
    divTaxAgg,
    interestTaxPaid: 0,
    interestTaxGross: 0,
  });
  assert.ok(refunds.refundOwedRON < 2, `refund should be tiny (rounding only): ${refunds.refundOwedRON}`);
  // Each foreign WHT (10%) > 8% RO due → user owes 0 on dividends.
  assert.equal(divTaxAgg.roDivForeignTaxNet, 0);
});

// =========================================================================
// SCENARIO 4: Revolut foreign broker (no source withholding on capgains)
// =========================================================================
test('integration: Revolut foreign broker (LT, no source WHT on capgains)', () => {
  const year = 2025;
  const rates = BNR_EXCHANGE_RATES[year];
  const yd = {
    revolutStatement: {
      countries: [
        { country: 'US', currency: 'USD',
          longGainRON: 1000, longLossRON: 200,
          shortGainRON: 3000, shortLossRON: 500 },
        { country: 'DE', currency: 'EUR',
          longGainRON: 500, longLossRON: 0,
          shortGainRON: 0, shortLossRON: 0 },
      ],
    },
  };
  const ctx = { usdRate: rates.usdRon, eurRate: rates.eurRon, year };
  const cap14Rows = buildCap14Rows({
    divTaxRate: 0.08,
    capGainsTaxRate: 0.10,
  });
  // buildCap14Rows alone doesn't read revolutStatement — it's added inline
  // in app.js. For Revolut we rely on the inline emission tested elsewhere
  // via test/d212-xml-builder.test.js. Sanity-check that this isolated
  // call doesn't accidentally produce a row for Revolut.
  assert.equal(cap14Rows.filter(r => r.str_categ_venit === '2012').length, 0);
});

// =========================================================================
// SCENARIO 5: Over-withholding → refund (RO broker, capgains)
// =========================================================================
test('integration: RO broker over-withheld capgains tax → refund detected', () => {
  const year = 2025;
  const rates = BNR_EXCHANGE_RATES[year];
  // User has 10,000 RON short gain (3% tax = 300 RON due) but the broker
  // withheld 800 RON before applying losses. Without the refund logic the
  // user would pay 0 extra and just "lose" the 500 RON excess. With it,
  // refundOwedRON surfaces as 500 so the user can claim it on D212.
  const yd = {
    xtbPortfolio: {
      longTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
      shortTerm: { gainRON: 10000, lossRON: 0, taxWithheldRON: 800 },
      totalTaxWithheldRON: 800,
      countries: [
        { country: 'GERMANIA / XETRA', currency: 'RON',
          longGainRON: 0, longLossRON: 0, longTaxRON: 0,
          shortGainRON: 10000, shortLossRON: 0, shortTaxRON: 800 },
      ],
    },
  };
  const ctx = { usdRate: rates.usdRon, eurRate: rates.eurRon, year };
  const resRoCG = Resolvers.resolveRoBrokerGains(yd, ctx);
  assert.equal(resRoCG.shortGainRON, 10000);
  assert.equal(resRoCG.taxWithheldRON, 800);

  const roCapitalGainsTax = 10000 * 0.03; // 300
  const refunds = detectRefunds({
    roPortTaxWithheld: 800,
    roCapitalGainsTax,
    divTaxAgg: aggregateDividendTax({
      resUsDiv: Resolvers.resolveUsDividends(yd, ctx),
      resRoDiv: Resolvers.resolveRoBrokerDividends(yd, ctx),
      divTaxRate: 0.08,
    }),
    interestTaxPaid: 0,
    interestTaxGross: 0,
  });
  assert.equal(refunds.roCapGainsOverwithheld, 500);
  assert.equal(refunds.refundOwedRON, 500);
});

// =========================================================================
// SCENARIO 6: Regression — capgains GROSS (D205 matching) vs NET (cap11)
// =========================================================================
test('integration: capgains GROSS for D205 vs NET for cap11/D212', () => {
  // ANAF D205 reports per-trade gross gain (broker withholds per profitable
  // trade, not on the year net). D212 cap11 reports the net (gain - loss)
  // as venit_brut + the carry-forward loss in pierdere.
  const year = 2025;
  const rates = BNR_EXCHANGE_RATES[year];
  const yd = {
    xtbPortfolio: {
      longTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
      shortTerm: { gainRON: 427094, lossRON: 37699, taxWithheldRON: 12812 },
      totalTaxWithheldRON: 12812,
      countries: [
        { country: 'GERMANIA / XETRA', currency: 'RON',
          longGainRON: 0, longLossRON: 0, longTaxRON: 0,
          shortGainRON: 427094, shortLossRON: 37699, shortTaxRON: 12812 },
      ],
    },
  };
  const ctx = { usdRate: rates.usdRon, eurRate: rates.eurRon, year };
  const resRoCG = Resolvers.resolveRoBrokerGains(yd, ctx);
  // Resolver: NET (gain - loss) = 427094 - 37699 = 389395.
  assert.equal(resRoCG.shortGainRON, 389395);
  // No cross-bucket residual loss (net positive within the bucket).
  assert.equal(resRoCG.currentYearLossRON, 0);

  // D205 matcher uses GROSS via lib/d205-matcher.js: buildLocalBreakdown.
  // It reads directly from xtbPortfolio.countries[].shortGainRON, which is
  // the GROSS 427094. Verified end-to-end in test/d205-matcher.test.js
  // (regression test added in commit b46a269).
  const { matchD205 } = require('../lib/d205-matcher');
  const d205Entries = [
    { payerName: 'Xtb SA Varsovia Sucursala Bucuresti', category: '27', grossRON: 427095, taxRON: 12812 },
  ];
  const r = matchD205(d205Entries, yd);
  const match = r.matches.find(m => m.status === 'matched-exact');
  assert.ok(match);
  // The local row should have GROSS=427094, not NET=389395.
  assert.equal(Math.round(match.local.grossRON), 427094);

  // cap11 uses NET via resolver: venit_brut = 389395.
  const cap11Rows = buildCap11Rows({
    roLongTermGainRON: 0,
    roShortTermGainRON: 389395,
    currentYearLossRON: 0,
    roCapitalGainsTax: 389395 * 0.03,
    roPortTaxWithheld: 12812,
  });
  assert.equal(cap11Rows[0].venit_brut, 389395);
});

// =========================================================================
// SCENARIO 7: CASS owed SEPARATELY for PFA + investments (filed D212 regression)
// =========================================================================
//
// The actual filed D212 (cross-checked 2026-05-26) shows two SEPARATE CASS
// lines, NOT a single combined one:
//   - Subsec 2.1 (PFA, art. 155(1)b): tier 6-12SM → base 24.300 → CASS 2.430
//   - Subsec 2.2 (investments, art. 155(1)c-h): tier >24SM → base 97.200 → 9.720
//   - Total CASS paid: 12.150 RON (NOT 9.720 — they are NOT combined)
//
// The formula is the same 3-tier ladder (6/12/24 SM), but applied SEPARATELY
// to each income category. A user with both PFA and investment income owes
// the SUM of the two CASS amounts.

test('integration: CASS for PFA + investments are SEPARATE (no cumulation)', () => {
  // Reproduce the 3-tier formula inline so the test stays decoupled from
  // the browser-only calculateCASS function. Verified against the actual
  // filed D212 declaration (Cod fiscal art. 170 alin. (2)).
  const SM_2025 = 4050;
  const calc3Tier = (income, sm) => {
    const t6 = 6 * sm, t12 = 12 * sm, t24 = 24 * sm;
    if (income < t6) return { applies: false, base: 0, amount: 0, tier: '<6SM' };
    if (income < t12) return { applies: true, base: t6, amount: t6 * 0.10, tier: '6-12SM' };
    if (income < t24) return { applies: true, base: t12, amount: t12 * 0.10, tier: '12-24SM' };
    return { applies: true, base: t24, amount: t24 * 0.10, tier: '>24SM' };
  };

  // User profile: PFA net 30.000 RON (tier 6-12SM) + investments 517.132 RON (tier >24SM).
  const pfaCASS = calc3Tier(30000, SM_2025);
  const invCASS = calc3Tier(517132, SM_2025);

  assert.equal(pfaCASS.tier, '6-12SM');
  assert.equal(pfaCASS.base, 24300);  // 6 × 4050
  assert.equal(pfaCASS.amount, 2430); // 10% of 24300 — matches filed D212

  assert.equal(invCASS.tier, '>24SM');
  assert.equal(invCASS.base, 97200);  // 24 × 4050
  assert.equal(invCASS.amount, 9720); // 10% of 97200 — matches filed D212

  // Total CASS = sum of both — NOT computed once on the combined income.
  const totalCASS = pfaCASS.amount + invCASS.amount;
  assert.equal(totalCASS, 12150, 'CASS PFA + CASS investments must be summed, not cumulated through one threshold');

  // If you naively combined the incomes (30000 + 517132 = 547132), you would
  // still land at >24SM tier = 9720 RON, which would UNDER-state CASS by
  // 2430 RON (the PFA CASS that was earned separately).
  const wrongCombined = calc3Tier(30000 + 517132, SM_2025);
  assert.equal(wrongCombined.amount, 9720);
  assert.notEqual(wrongCombined.amount, totalCASS, 'Combined calculation would under-state CASS');
});

test('integration: PFA-only user (no investments) still owes PFA CASS', () => {
  const SM_2025 = 4050;
  const calc3Tier = (income, sm) => {
    const t6 = 6 * sm, t12 = 12 * sm, t24 = 24 * sm;
    if (income < t6) return { applies: false, base: 0, amount: 0, tier: '<6SM' };
    if (income < t12) return { applies: true, base: t6, amount: t6 * 0.10, tier: '6-12SM' };
    if (income < t24) return { applies: true, base: t12, amount: t12 * 0.10, tier: '12-24SM' };
    return { applies: true, base: t24, amount: t24 * 0.10, tier: '>24SM' };
  };
  // Net PFA 25.000 RON → tier 6-12SM (since 24300 ≤ 25000 < 48600)
  const r = calc3Tier(25000, SM_2025);
  assert.equal(r.tier, '6-12SM');
  assert.equal(r.amount, 2430);
});

test('integration: PFA income below 6 SM threshold owes NO PFA CASS', () => {
  const SM_2025 = 4050;
  const calc3Tier = (income, sm) => {
    const t6 = 6 * sm, t12 = 12 * sm, t24 = 24 * sm;
    if (income < t6) return { applies: false, base: 0, amount: 0, tier: '<6SM' };
    if (income < t12) return { applies: true, base: t6, amount: t6 * 0.10, tier: '6-12SM' };
    if (income < t24) return { applies: true, base: t12, amount: t12 * 0.10, tier: '12-24SM' };
    return { applies: true, base: t24, amount: t24 * 0.10, tier: '>24SM' };
  };
  // PFA = 10.000 RON, below 24.300 threshold → no CASS owed for PFA
  const r = calc3Tier(10000, SM_2025);
  assert.equal(r.applies, false);
  assert.equal(r.amount, 0);
});

// =========================================================================
// SCENARIO 8: PFA below 6 SM with art. 180(2) opt-in — pay anyway
// =========================================================================
//
// Cod fiscal art. 180(2) lets a person whose PFA net income is below 6 SM
// (24.300 for 2025) ELECT to pay CASS at the minimum 6 SM base. The
// election must be exercised explicitly by filing D212 with the opt-in
// marked. The app reflects this via the `yd.pfaOptInCASS` boolean.

test('integration: PFA opt-in art. 180(2) forces minimum 6 SM base when below threshold', () => {
  const SM_2025 = 4050;
  const calc3Tier = (income, sm) => {
    const t6 = 6 * sm, t12 = 12 * sm, t24 = 24 * sm;
    if (income < t6) return { applies: false, base: 0, amount: 0, tier: '<6SM' };
    if (income < t12) return { applies: true, base: t6, amount: t6 * 0.10, tier: '6-12SM' };
    if (income < t24) return { applies: true, base: t12, amount: t12 * 0.10, tier: '12-24SM' };
    return { applies: true, base: t24, amount: t24 * 0.10, tier: '>24SM' };
  };
  // Mirror the inline app.js branch: opt-in forces 6 SM base when the
  // natural calc would have returned applies=false.
  const applyOptIn = (result, sm, optedIn) => {
    if (result.applies || !optedIn) return result;
    const t6 = 6 * sm;
    return { applies: true, base: t6, amount: t6 * 0.10, tier: '6-12SM-opt-in', optedIn: true };
  };

  // Net PFA 23.498 RON (below 24.300 — matches the user's actual filed value).
  const natural = calc3Tier(23498, SM_2025);
  assert.equal(natural.applies, false);
  assert.equal(natural.amount, 0);

  const withOptIn = applyOptIn(natural, SM_2025, true);
  assert.equal(withOptIn.applies, true);
  assert.equal(withOptIn.base, 24300);
  assert.equal(withOptIn.amount, 2430);
  assert.equal(withOptIn.tier, '6-12SM-opt-in');
  assert.equal(withOptIn.optedIn, true);

  // Verify the opt-in does NOT force the calc when already applying
  // (above 6 SM threshold).
  const above = calc3Tier(30000, SM_2025);
  const aboveWithOptIn = applyOptIn(above, SM_2025, true);
  assert.equal(aboveWithOptIn.amount, above.amount, 'Opt-in must not alter the natural calc when already applies');
});

// =========================================================================
// SCENARIO 9: PFA income tax — 10% on (net − deductible CASS)
// =========================================================================
//
// Per Cod fiscal art. 64-67 + art. 118: PFA income tax = (venit_net −
// CAS_deductibilă − CASS_deductibilă) × 10%. CASS deductibilă is capped
// at 10% of venit_net (not at the opt-in base), per D212 cap I §4.2 rd.6.

test('integration: PFA income tax — CASS deductibility cap (matches filed D212)', () => {
  // User profile from filed D212: net PFA 23.498, CASS PFA opt-in = 2.430
  // (forced 6 SM base). Expected: deductible CASS capped at 23.498×10% = 2.350,
  // not the full 2.430. Taxable = 21.148, tax = 2.115.
  const pfaNetIncome = 23498;
  const pfaCassActual = 2430; // CASS PFA owed (opt-in)
  const pfaIncomeTaxRate = 0.10;

  const pfaCassDeductible = Math.min(pfaCassActual, pfaNetIncome * 0.10);
  const pfaTaxableIncome = Math.max(0, pfaNetIncome - pfaCassDeductible);
  const pfaIncomeTax = Math.round(pfaTaxableIncome * pfaIncomeTaxRate);

  assert.equal(pfaCassDeductible, 2349.8); // = 23498 × 10%, capped under 2430
  assert.equal(pfaTaxableIncome, 23498 - 2349.8);
  assert.equal(pfaIncomeTax, 2115); // matches filed D212 cap I §4
});

test('integration: PFA income tax — when CASS < 10% of net, full CASS is deductible', () => {
  // Edge case: if income is so high that calculated CASS < 10% × net,
  // the deductible is the full CASS (no cap kicks in). This happens when
  // CASS lands in tier 6-12SM or 12-24SM but the actual income is higher
  // than the base × 1.0 (which means CASS_owed < 10% × income_real).
  const pfaNetIncome = 50000;        // above 12 SM, below 24 SM
  const pfaCassActual = 4860;        // = 12 × 4050 × 10% (tier 12-24SM)
  // 10% × 50000 = 5000, so CASS_owed (4860) < cap (5000) → full deductible.
  const pfaCassDeductible = Math.min(pfaCassActual, pfaNetIncome * 0.10);
  assert.equal(pfaCassDeductible, 4860);
});
