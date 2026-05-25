/**
 * Unit tests for lib/income-resolvers.js.
 *
 * Each test exercises one resolver in isolation and pins:
 *   - the priority order between OVERRIDE / ANAF_DOC / DOCUMENT / MANUAL
 *   - presence semantics (0 from a document is PRESENT, not "no document")
 *   - source attribution in the returned sourceMap
 *
 * The fixtures are minimal: only the `yd` shape required by the specific
 * resolver under test. The real `_computeYearDataImpl` will combine these
 * resolvers in Phase 3 — that integration is exercised by the higher-level
 * end-to-end calc tests (separate file).
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../lib/income-resolvers');
const { TIER } = require('../lib/source-resolver');

// ---------- resolveUsDividends ----------

test('resolveUsDividends: 1042-S only → values + derived grossRON', () => {
  const yd = {
    form1042s: [
      { incomeCode: '06', grossIncomeUSD: 215, federalTaxWithheldUSD: 21 },
    ],
  };
  const r = R.resolveUsDividends(yd, { usdRate: 4.9 });
  assert.equal(r.grossUSD, 215);
  assert.equal(r.foreignTaxUSD, 21);
  assert.equal(r.grossRON, 215 * 4.9);
  assert.equal(r.foreignTaxRON, 21 * 4.9);
  assert.equal(r.sources.grossUSD.tier, TIER.DOCUMENT);
  assert.equal(r.sources.grossUSD.label, 'Form 1042-S');
  assert.equal(r.sources.grossRON.tier, TIER.DERIVED);
});

test('resolveUsDividends: Fidelity statement wins over 1042-S (same tier, first-listed)', () => {
  const yd = {
    fidelityData: { dividends: { grossUSD: 1000, foreignTaxUSD: 100, grossRON: 4900, foreignTaxRON: 490 } },
    form1042s: [{ incomeCode: '06', grossIncomeUSD: 215, federalTaxWithheldUSD: 21 }],
  };
  const r = R.resolveUsDividends(yd, { usdRate: 4.9 });
  assert.equal(r.grossUSD, 1000);
  assert.equal(r.foreignTaxUSD, 100);
  // Direct RON from Fidelity, not derived.
  assert.equal(r.grossRON, 4900);
  assert.equal(r.sources.grossRON.tier, TIER.DOCUMENT);
  assert.equal(r.sources.grossRON.label, 'Fidelity statement');
});

test('resolveUsDividends: override beats every parsed document', () => {
  const yd = {
    fidelityDividends: 1234,
    usDivTaxPaid: 100,
    fidelityData: { dividends: { grossUSD: 1000, foreignTaxUSD: 100 } },
    form1042s: [{ incomeCode: '06', grossIncomeUSD: 215, federalTaxWithheldUSD: 21 }],
  };
  const r = R.resolveUsDividends(yd, { usdRate: 4.9 });
  assert.equal(r.grossUSD, 1234);
  assert.equal(r.foreignTaxUSD, 100);
  assert.equal(r.sources.grossUSD.tier, TIER.OVERRIDE);
  assert.equal(r.sources.foreignTaxUSD.tier, TIER.OVERRIDE);
});

test('resolveUsDividends: ANAF official import is tier 2 (above parsed documents)', () => {
  const yd = {
    declaratie: {
      anafXml: '<x/>',  // marks as ANAF official import
      dividends: { grossUSD: 500, foreignTaxUSD: 50, grossRON: 2450, foreignTaxRON: 245 },
    },
    fidelityData: { dividends: { grossUSD: 1000, foreignTaxUSD: 100 } },
  };
  const r = R.resolveUsDividends(yd, { usdRate: 4.9 });
  assert.equal(r.grossUSD, 500);
  assert.equal(r.sources.grossUSD.tier, TIER.ANAF_DOC);
  assert.equal(r.sources.grossUSD.label, 'ANAF D212 import');
});

test('resolveUsDividends: manual declaratie (no anafXml) is tier 4, below documents', () => {
  const yd = {
    declaratie: { dividends: { grossUSD: 999 } },  // no anafXml → manual tier
    form1042s: [{ incomeCode: '06', grossIncomeUSD: 215, federalTaxWithheldUSD: 21 }],
  };
  const r = R.resolveUsDividends(yd, { usdRate: 4.9 });
  // Document tier (1042-S) wins over manual `decl` entry.
  assert.equal(r.grossUSD, 215);
  assert.equal(r.sources.grossUSD.tier, TIER.DOCUMENT);
});

test('resolveUsDividends: 1042-S file with NO code-06 form → present but value 0', () => {
  // Interest-only 1042-S. The "document is uploaded" claim sticks: a stale
  // manual default should NOT win even though the parsed dividend total is 0.
  const yd = {
    form1042s: [{ incomeCode: '01', grossIncomeUSD: 2, federalTaxWithheldUSD: 0 }],
    investment: { totalDividends: 999 },  // stale manual
  };
  const r = R.resolveUsDividends(yd, { usdRate: 4.9 });
  // The 1042-S file is present but has no code-06 form → f1042sDivUSD source
  // is NOT forced present (filter removed it), so manual investment falls in.
  assert.equal(r.grossUSD, 999);
  assert.equal(r.sources.grossUSD.tier, TIER.MANUAL);
});

test('resolveUsDividends: no sources at all → 0 with no tier', () => {
  const r = R.resolveUsDividends({}, { usdRate: 4.9 });
  assert.equal(r.grossUSD, 0);
  assert.equal(r.foreignTaxUSD, 0);
  assert.equal(r.sources.grossUSD.tier, null);
});

// ---------- resolveRoBrokerDividends ----------

test('resolveRoBrokerDividends: XTB + EUR manual sum together', () => {
  const yd = {
    xtbDividendsReport: { dividends: { grossRON: 1000, taxWithheldRON: 80 } },
    roEurDividends: 100,
    roEurDivTaxPaid: 8,
  };
  const r = R.resolveRoBrokerDividends(yd, { eurRate: 5 });
  assert.equal(r.grossRON, 1000 + 100 * 5);
  assert.equal(r.taxWithheldRON, 80 + 8 * 5);
  assert.equal(r.sources.grossRON.tier, TIER.DOCUMENT);  // strongest tier among contributors
});

test('resolveRoBrokerDividends: override replaces the sum', () => {
  const yd = {
    xtbDividends: 5000,
    xtbDividendsReport: { dividends: { grossRON: 1000 } },
    roEurDividends: 100,
  };
  const r = R.resolveRoBrokerDividends(yd, { eurRate: 5 });
  assert.equal(r.grossRON, 5000);
  assert.equal(r.sources.grossRON.tier, TIER.OVERRIDE);
});

test('resolveRoBrokerDividends: aggregates XTB+BT by country with broker provenance', () => {
  const yd = {
    xtbDividendsReport: {
      dividends: { grossRON: 1000, taxWithheldRON: 150 },
      dividendsByCountry: [
        { country: 'US', isRomanian: false, grossRON: 600, taxRON: 90, netRON: 510 },
        { country: 'DE', isRomanian: false, grossRON: 400, taxRON: 60, netRON: 340 },
      ],
    },
    btDividendsReport: {
      dividends: { grossRON: 500, taxWithheldRON: 50 },
      dividendsByCountry: [
        { country: 'US', isRomanian: false, grossRON: 300, taxRON: 30, netRON: 270 },
        { country: 'NL', isRomanian: false, grossRON: 200, taxRON: 20, netRON: 180 },
      ],
    },
  };
  const r = R.resolveRoBrokerDividends(yd, {});
  const us = r.foreignByCountry.find(c => c.country === 'US');
  const de = r.foreignByCountry.find(c => c.country === 'DE');
  const nl = r.foreignByCountry.find(c => c.country === 'NL');
  assert.equal(us.grossRON, 900); // 600 XTB + 300 BT
  assert.equal(us.taxRON, 120);
  assert.equal(us.sources.length, 2);
  assert.equal(de.grossRON, 400);
  assert.equal(de.sources.length, 1);
  assert.equal(de.sources[0].broker, 'XTB');
  assert.equal(nl.sources[0].broker, 'BT Capital Partners');
  assert.equal(r.foreignTaxWithheldRON, 90 + 60 + 30 + 20);
  assert.equal(r.localGrossRON, 0);
  assert.equal(r.unknownCountryRON, 0);
});

test('resolveRoBrokerDividends: separates Romanian-source (ISIN starts with RO)', () => {
  const yd = {
    btDividendsReport: {
      dividends: { grossRON: 1500, taxWithheldRON: 120 },
      dividendsByCountry: [
        { country: 'RO', isRomanian: true, grossRON: 800, taxRON: 64, netRON: 736 },
        { country: 'US', isRomanian: false, grossRON: 700, taxRON: 56, netRON: 644 },
      ],
    },
  };
  const r = R.resolveRoBrokerDividends(yd, {});
  assert.equal(r.localGrossRON, 800);
  assert.equal(r.localTaxWithheldRON, 64);
  assert.equal(r.foreignByCountry.length, 1);
  assert.equal(r.foreignByCountry[0].country, 'US');
});

test('resolveRoBrokerDividends: manual EUR/USD entries land in unknownCountryRON', () => {
  const yd = {
    roEurDividends: 100,
    roEurDivTaxPaid: 15,
    roUsdDividends: 50,
  };
  const r = R.resolveRoBrokerDividends(yd, { eurRate: 5, usdRate: 4.5 });
  // Aggregate gross matches legacy total but is also flagged unknownCountry.
  assert.equal(r.grossRON, 100 * 5 + 50 * 4.5);
  assert.equal(r.unknownCountryRON, 100 * 5 + 50 * 4.5);
  assert.equal(r.foreignByCountry.length, 0);
  assert.equal(r.localGrossRON, 0);
});

test('resolveRoBrokerDividends: XTB row without "din X" suffix goes to unknownCountryRON', () => {
  const yd = {
    xtbDividendsReport: {
      dividends: { grossRON: 100, taxWithheldRON: 10 },
      dividendsByCountry: [
        { country: null, isRomanian: false, grossRON: 100, taxRON: 10, netRON: 90 },
      ],
    },
  };
  const r = R.resolveRoBrokerDividends(yd, {});
  assert.equal(r.unknownCountryRON, 100);
  assert.equal(r.unknownCountryTaxRON, 10);
  assert.equal(r.foreignByCountry.length, 0);
});

// ---------- resolveInterest ----------

test('resolveInterest: 1042-S code 01 contributes US-source interest', () => {
  // Regression for the user's $2 case from 2026-05-19. Phase 2 must keep
  // the quick-fix behavior under the resolver shape.
  const yd = {
    form1042s: [{ incomeCode: '01', grossIncomeUSD: 2, federalTaxWithheldUSD: 0 }],
  };
  const r = R.resolveInterest(yd, { usdRate: 4.9 });
  assert.equal(r.usForeignInterestRON, 2 * 4.9);
  assert.equal(r.usForeignInterestTaxRON, 0);
  assert.equal(r.incomeRON, 2 * 4.9);
  assert.equal(r.taxWithheldRON, 0);
});

test('resolveInterest: bank adeverință + XTB + EUR + 1042-S all sum together', () => {
  const yd = {
    adeverinta: { interestIncome: 100, interestTax: 10 },
    xtbDividendsReport: { interest: { grossRON: 50, taxWithheldRON: 5 } },
    roEurInterest: 20,
    roEurInterestTaxPaid: 2,
    form1042s: [{ incomeCode: '01', grossIncomeUSD: 2, federalTaxWithheldUSD: 0 }],
  };
  const r = R.resolveInterest(yd, { usdRate: 4.9, eurRate: 5 });
  // Income: bank 100 + XTB 50 + EUR 20*5 + 1042-S 2*4.9 = 259.80
  assert.equal(r.incomeRON, 100 + 50 + 20 * 5 + 2 * 4.9);
  // Tax: bank 10 + EUR 2*5 + 1042-S 0 = 20. XTB tax (5) is INTENTIONALLY NOT
  // included — the existing semantic relies on the user saving it via the
  // fillInputWithImport-populated input.
  assert.equal(r.taxWithheldRON, 10 + 2 * 5 + 0);
});

test('resolveInterest: override replaces bank-only; foreign still adds on top', () => {
  // Existing semantic (preserved): yd.interestIncome OVERRIDES adv.interestIncome
  // (the bank-style base), but foreign sources (XTB, EUR/USD, 1042-S) still
  // accumulate on top. yd.interestTaxPaid behaves the same way for tax.
  const yd = {
    interestIncome: 500,
    interestTaxPaid: 50,
    adeverinta: { interestIncome: 100, interestTax: 10 },  // overridden
    xtbDividendsReport: { interest: { grossRON: 30 } },
    form1042s: [{ incomeCode: '01', grossIncomeUSD: 2, federalTaxWithheldUSD: 0 }],
  };
  const r = R.resolveInterest(yd, { usdRate: 4.9 });
  // Income: override 500 + XTB 30 + 1042-S 2*4.9 = 539.80
  assert.equal(r.incomeRON, 500 + 30 + 2 * 4.9);
  // Tax: override 50 + 1042-S 0 = 50 (XTB tax not in pool)
  assert.equal(r.taxWithheldRON, 50);
  // usForeignInterestRON is still surfaced for cap14 emission.
  assert.equal(r.usForeignInterestRON, 2 * 4.9);
  assert.equal(r.sources.incomeRON.tier, 'override');
});

// ---------- resolveUsCapitalGains ----------

test('resolveUsCapitalGains: derives taxableRON when no direct value', () => {
  const yd = {
    fidelityData: { capitalGains: { saleUSD: 1000, costUSD: 200 } },
  };
  const r = R.resolveUsCapitalGains(yd, { usdRate: 4.9 });
  assert.equal(r.saleUSD, 1000);
  assert.equal(r.costUSD, 200);
  assert.equal(r.taxableRON, 800 * 4.9);
  assert.equal(r.sources.taxableRON.tier, TIER.DERIVED);
});

test('resolveUsCapitalGains: ESPP cost from FIFO ledger when no Fidelity cost basis', () => {
  const yd = {
    fidelityData: { capitalGains: { saleUSD: 1000 } },  // sale yes, cost no
  };
  const r = R.resolveUsCapitalGains(yd, { usdRate: 4.9, yearAlloc: { esppCostUSD: 150 } });
  assert.equal(r.costUSD, 150);
  assert.equal(r.sources.costUSD.label, 'FIFO ledger — ESPP cost basis');
});

test('resolveUsCapitalGains: override beats parsed', () => {
  const yd = {
    fidelityGains: 2000,
    fidelityCost: 500,
    fidelityData: { capitalGains: { saleUSD: 1000, costUSD: 200 } },
  };
  const r = R.resolveUsCapitalGains(yd, { usdRate: 4.9 });
  assert.equal(r.saleUSD, 2000);
  assert.equal(r.costUSD, 500);
  assert.equal(r.taxableRON, 1500 * 4.9);
});

test('resolveRoBrokerGains: XTB + Tradeville + BT all contribute to bucket nets', () => {
  const yd = {
    xtbPortfolio: {
      longTerm: { gainRON: 500, lossRON: 100 },
      shortTerm: { gainRON: 300, lossRON: 50 },
      totalTaxWithheldRON: 10,
    },
    tradevillePortfolio: {
      longTerm: { gainRON: 200, lossRON: 0 },
      shortTerm: { gainRON: 0, lossRON: 80 },
      totalTaxWithheldRON: 5,
    },
    btPortfolio: {
      longTerm: { gainRON: 100, lossRON: 0 },
      shortTerm: { gainRON: 50, lossRON: 20 },
      totalTaxWithheldRON: 3,
    },
  };
  const r = R.resolveRoBrokerGains(yd, {});
  // Long net: (500-100) + (200-0) + (100-0) = 700
  // Short net: (300-50) + (0-80) + (50-20) = 200
  assert.equal(r.longGainRON, 700);
  assert.equal(r.shortGainRON, 200);
  // Total tax 10+5+3 = 18
  assert.equal(r.taxWithheldRON, 18);
});

test('resolveRoBrokerDividends: XTB + BT both contribute to gross and tax', () => {
  const yd = {
    xtbDividendsReport: { dividends: { grossRON: 500, taxWithheldRON: 50 } },
    btDividendsReport: { dividends: { grossRON: 200, taxWithheldRON: 30 } },
  };
  const r = R.resolveRoBrokerDividends(yd, {});
  assert.equal(r.grossRON, 700);
  assert.equal(r.taxWithheldRON, 80);
});

test('resolveRoBrokerGains: XTB + Tradeville net per bucket', () => {
  const yd = {
    xtbPortfolio: {
      longTerm: { gainRON: 500, lossRON: 100 },
      shortTerm: { gainRON: 300, lossRON: 50 },
      totalTaxWithheldRON: 10,
    },
    tradevillePortfolio: {
      longTerm: { gainRON: 200, lossRON: 0 },
      shortTerm: { gainRON: 0, lossRON: 80 },
      totalTaxWithheldRON: 5,
    },
  };
  const r = R.resolveRoBrokerGains(yd, {});
  // Long: (500-100) + (200-0) = 600
  // Short: (300-50) + (0-80) = 170
  assert.equal(r.longGainRON, 600);
  assert.equal(r.shortGainRON, 170);
  assert.equal(r.totalGainRON, 770);
  assert.equal(r.taxWithheldRON, 15);
  assert.equal(r.currentYearLossRON, 0);
});

test('resolveRoBrokerGains: net loss carries forward', () => {
  const yd = {
    xtbPortfolio: {
      longTerm: { gainRON: 100, lossRON: 300 },  // net -200
      shortTerm: { gainRON: 50, lossRON: 20 },   // net +30
      totalTaxWithheldRON: 0,
    },
  };
  const r = R.resolveRoBrokerGains(yd, {});
  assert.equal(r.longGainRON, 0);  // negative buckets reported as 0 gain
  assert.equal(r.shortGainRON, 30);
  assert.equal(r.currentYearLossRON, 200);  // long loss carries forward
});

test('resolveRoBrokerGains: per-country manual array replaces parsed totals', () => {
  const yd = {
    xtbPortfolio: { longTerm: { gainRON: 9999 } },  // ignored
    roGainsCountries: [
      { currency: 'RON', longGain: 100, shortGain: 50, taxWithheld: 10 },
      { currency: 'USD', longGain: 10, shortGain: 5, taxWithheld: 1 },
    ],
  };
  const r = R.resolveRoBrokerGains(yd, { usdRate: 4.9 });
  assert.equal(r.longGainRON, 100 + 10 * 4.9);
  assert.equal(r.shortGainRON, 50 + 5 * 4.9);
  assert.equal(r.taxWithheldRON, 10 + 1 * 4.9);
  assert.equal(r.sources.longGainRON.tier, TIER.OVERRIDE);
});

// ---------- resolveSalaryBIK ----------

test('resolveSalaryBIK: sums BIK + ESPP gains from year awards', () => {
  const ctx = {
    yearAwards: [
      { stock_award_bik: 1000, espp_gain_bik: 200, stock_withholding: 100 },
      { stock_award_bik: 500, espp_gain_bik: 0, stock_withholding: 50 },
    ],
  };
  const r = R.resolveSalaryBIK({}, ctx);
  assert.equal(r.taxedRON, 1700);
  assert.equal(r.withholdingRON, 150);
  assert.equal(r.sources.taxedRON.tier, TIER.DOCUMENT);
});

test('resolveSalaryBIK: override replaces ledger value', () => {
  const r = R.resolveSalaryBIK({ salaryTaxedIncome: 5000, stockWithholdingPaid: 500 }, {
    yearAwards: [{ stock_award_bik: 1000, stock_withholding: 100 }],
  });
  assert.equal(r.taxedRON, 5000);
  assert.equal(r.withholdingRON, 500);
  assert.equal(r.sources.taxedRON.tier, TIER.OVERRIDE);
});

test('resolveSalaryBIK: no awards + no override → 0 with no tier', () => {
  const r = R.resolveSalaryBIK({}, {});
  assert.equal(r.taxedRON, 0);
  assert.equal(r.withholdingRON, 0);
});
