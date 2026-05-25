/**
 * Per-category income resolvers.
 *
 * These functions read year data (`yd`) + an exchange / tax context and
 * return a structured object holding the chosen value(s) plus a sourceMap
 * the UI can render as 📄 / ✋ / 🛠️ / 🏛️ badges. They are the future
 * replacement for the inline `||` priority chains in
 * `_computeYearDataImpl` (public/js/app.js).
 *
 * Each resolver is a pure function — it never mutates `yd` and never
 * touches the network. They are exercised by the per-category tests in
 * `test/income-resolvers.test.js`.
 *
 * Priority model (see lib/source-resolver.js):
 *   Tier 1 OVERRIDE  — explicit `yd.<field>` set on Add Data (user said "I know better")
 *   Tier 2 ANAF_DOC  — official ANAF D212 PDF/XML import (`decl.anafXml` flag)
 *   Tier 3 DOCUMENT  — parsed broker document (Fidelity, 1042-S, XTB, MS, Tradeville)
 *   Tier 4 MANUAL    — manual default entry on Add Data (no document yet)
 *   Tier 5 DERIVED   — computed from another resolved value (X × BNR)
 */

'use strict';

// Wrap the module body in an IIFE so the top-level `const TIER`, function
// declarations, and `const _SR` stay local. See `source-resolver.js` for
// why: without the IIFE, loading both /lib scripts in the browser produces
// a "Identifier 'TIER' has already been declared" SyntaxError because both
// non-module <script> tags share the same global scope.
(function () {

// Dual import: use CommonJS require() when running in Node (server + tests);
// fall back to `window.SourceResolver` when loaded as a <script> in the
// browser. The two paths point at the SAME source-resolver.js file (served
// statically from /lib/), so the browser executes the exact code that the
// tests cover.
const _SR = (typeof module !== 'undefined' && module.exports)
  ? require('./source-resolver')
  : (typeof window !== 'undefined' ? window.SourceResolver : null);
if (!_SR) {
  throw new Error('income-resolvers: source-resolver dependency not loaded');
}
const { TIER, source, pickFirst, sumPresent, deriveValue } = _SR;

/** Helper: did the user import an official ANAF D212 envelope? */
function _hasAnafDecl(yd) {
  const decl = (yd && yd.declaratie) || {};
  return !!(decl.anafXml || decl.anafFlatText);
}

/**
 * US-source dividends.
 *
 * Reads:
 *   yd.fidelityData.dividends       (Fidelity statement)
 *   yd.form1042s[].incomeCode==='06' (1042-S dividend forms)
 *   yd.fidelityDividendsYTD          (Fidelity YTD shortcut, USD only)
 *   yd.fidelityTaxWithheldYTD        (Fidelity YTD tax withheld)
 *   yd.declaratie.dividends          (ANAF official import OR manual default)
 *   yd.investment                    (manual investment-report form)
 *   yd.fidelityDividends             (explicit override, USD)
 *   yd.usDivTaxPaid                  (explicit override, USD tax)
 *
 * Returns `{grossUSD, grossRON, foreignTaxUSD, foreignTaxRON, sources}`.
 *
 * Notes:
 *  - When ANAF D212 was imported, the `decl.dividends.*` block is treated
 *    as ANAF_DOC tier; otherwise it's MANUAL tier. Identical structure,
 *    different trust level.
 *  - grossRON / foreignTaxRON prefer a direct value over a derived one
 *    (USD × BNR) because Fidelity already does the RON conversion at the
 *    statement-issue rate, which may differ slightly from the BNR daily
 *    rate we apply to USD.
 *  - This resolver does NOT sum across brokers; if the user has
 *    Fidelity + MS the manual override path is currently the only way to
 *    aggregate. Multi-broker summing is a separate gap (D-3 in the plan).
 */
function resolveUsDividends(yd, ctx) {
  yd = yd || {};
  ctx = ctx || {};
  const usdRate = ctx.usdRate || 1;
  const fd = yd.fidelityData || {};
  const fdDiv = fd.dividends || {};
  const decl = yd.declaratie || {};
  const declDiv = decl.dividends || {};
  const inv = yd.investment || {};
  const isAnaf = _hasAnafDecl(yd);
  const declTier = isAnaf ? TIER.ANAF_DOC : TIER.MANUAL;
  const declLabel = isAnaf ? 'ANAF D212 import' : 'Add Data — declarație';

  const form1042s = (yd.form1042s || []).filter(f => f.incomeCode === '06');
  const f1042sDivUSD = form1042s.reduce((s, f) => s + (f.grossIncomeUSD || 0), 0);
  const f1042sDivTaxUSD = form1042s.reduce((s, f) => s + (f.federalTaxWithheldUSD || 0), 0);
  // The 1042-S file may exist with no code-06 form (interest-only) — still
  // mark it present so the badge reflects "we read your 1042-S, it had no
  // dividend forms" rather than "no document".
  const has1042sFile = (yd.form1042s || []).length > 0;

  const grossUSD = pickFirst([
    source(yd.fidelityDividends, TIER.OVERRIDE, 'Manual override'),
    source(isAnaf ? declDiv.grossUSD : undefined, TIER.ANAF_DOC, 'ANAF D212 import'),
    source(fdDiv.grossUSD, TIER.DOCUMENT, 'Fidelity statement'),
    source(yd.fidelityDividendsYTD, TIER.DOCUMENT, 'Fidelity YTD'),
    source(f1042sDivUSD, TIER.DOCUMENT, 'Form 1042-S', { present: has1042sFile && form1042s.length > 0 }),
    source(!isAnaf ? declDiv.grossUSD : undefined, TIER.MANUAL, 'Add Data — declarație'),
    source(inv.totalDividends, TIER.MANUAL, 'Add Data — investment'),
  ]);

  const foreignTaxUSD = pickFirst([
    source(yd.usDivTaxPaid, TIER.OVERRIDE, 'Manual override'),
    source(isAnaf ? declDiv.foreignTaxUSD : undefined, TIER.ANAF_DOC, 'ANAF D212 import'),
    source(fdDiv.foreignTaxUSD, TIER.DOCUMENT, 'Fidelity statement'),
    source(yd.fidelityTaxWithheldYTD, TIER.DOCUMENT, 'Fidelity YTD'),
    source(f1042sDivTaxUSD, TIER.DOCUMENT, 'Form 1042-S', { present: has1042sFile && form1042s.length > 0 }),
    source(!isAnaf ? declDiv.foreignTaxUSD : undefined, TIER.MANUAL, 'Add Data — declarație'),
    source(inv.taxWithheld, TIER.MANUAL, 'Add Data — investment'),
  ]);

  // Prefer an explicit RON value if any source carries one; otherwise derive
  // by multiplying the chosen USD value by the BNR rate.
  const grossRON_picked = pickFirst([
    source(isAnaf ? declDiv.grossRON : undefined, TIER.ANAF_DOC, 'ANAF D212 import'),
    source(fdDiv.grossRON, TIER.DOCUMENT, 'Fidelity statement'),
    source(!isAnaf ? declDiv.grossRON : undefined, TIER.MANUAL, 'Add Data — declarație'),
  ]);
  const grossRON = grossRON_picked.present
    ? grossRON_picked
    : deriveValue(grossUSD.value * usdRate, [grossUSD], `USD × BNR ${usdRate}`);

  const foreignTaxRON_picked = pickFirst([
    source(isAnaf ? declDiv.foreignTaxRON : undefined, TIER.ANAF_DOC, 'ANAF D212 import'),
    source(fdDiv.foreignTaxRON, TIER.DOCUMENT, 'Fidelity statement'),
    source(!isAnaf ? declDiv.foreignTaxRON : undefined, TIER.MANUAL, 'Add Data — declarație'),
  ]);
  const foreignTaxRON = foreignTaxRON_picked.present
    ? foreignTaxRON_picked
    : deriveValue(foreignTaxUSD.value * usdRate, [foreignTaxUSD], `USD × BNR ${usdRate}`);

  return {
    grossUSD: grossUSD.value,
    grossRON: grossRON.value,
    foreignTaxUSD: foreignTaxUSD.value,
    foreignTaxRON: foreignTaxRON.value,
    sources: {
      grossUSD, grossRON, foreignTaxUSD, foreignTaxRON,
    },
  };
}

/**
 * Romania-broker dividends (XTB, BT Capital Partners, EUR/USD broker manual).
 *
 * Reads:
 *   yd.xtbDividendsReport.dividends   (XTB PDF parsed)
 *   yd.btDividendsReport.dividends    (BT Capital Partners PDF parsed)
 *   yd.roEurDividends / roUsdDividends and tax counterparts (manual broker EUR/USD)
 *   yd.xtbDividends                   (override RON)
 *   yd.roDivTaxPaid                   (override tax RON)
 *
 * Returns `{grossRON, taxWithheldRON, sources}`.
 *
 * Notes:
 *  - This is the "RO broker" channel for dividends, distinct from
 *    `resolveUsDividends`. Per Cod fiscal art. 91, Romanian brokers
 *    withhold the dividend tax at source so `taxWithheldRON` here usually
 *    fully covers the RO tax due.
 *  - The override fields replace the *sum*; if the user enters
 *    `yd.xtbDividends = 100` it does NOT add to XTB-parsed + EUR — it
 *    REPLACES the whole RO dividend total. This matches the existing
 *    behavior; a future "additive override" UX would be a separate change.
 */
function resolveRoBrokerDividends(yd, ctx) {
  yd = yd || {};
  ctx = ctx || {};
  const usdRate = ctx.usdRate || 1;
  const eurRate = ctx.eurRate || 1;
  const xtbDiv = yd.xtbDividendsReport || {};
  const btDiv = yd.btDividendsReport || {};

  // Override branch: if a manual override is set we honor it and stop.
  const overrideRON = source(yd.xtbDividends, TIER.OVERRIDE, 'Manual override');
  if (overrideRON.present) {
    const taxOverride = source(yd.roDivTaxPaid, TIER.OVERRIDE, 'Manual override');
    const taxFallback = sumPresent([
      source(xtbDiv.dividends?.taxWithheldRON, TIER.DOCUMENT, 'XTB Dividends'),
      source(btDiv.dividends?.taxWithheldRON, TIER.DOCUMENT, 'BT Capital Partners — Dividende'),
    ]);
    const taxRes = taxOverride.present ? taxOverride : taxFallback;
    return {
      grossRON: overrideRON.value,
      taxWithheldRON: taxRes.value,
      // Override path has no per-country detail by definition; downstream
      // cap14 emission must skip foreign-source rows in this branch.
      localGrossRON: 0,
      localTaxWithheldRON: 0,
      foreignByCountry: [],
      foreignTaxWithheldRON: 0,
      unknownCountryRON: overrideRON.value,
      unknownCountryTaxRON: taxRes.value,
      sources: { grossRON: overrideRON, taxWithheldRON: taxRes },
    };
  }

  // Aggregate path: sum every present source.
  const xtbRon = source(xtbDiv.dividends?.grossRON, TIER.DOCUMENT, 'XTB Dividends');
  const btRon = source(btDiv.dividends?.grossRON, TIER.DOCUMENT, 'BT Capital Partners — Dividende');
  const eurDiv = parseFloat(yd.roEurDividends) || 0;
  const usdDiv = parseFloat(yd.roUsdDividends) || 0;
  const eurDivRON = source(eurDiv ? eurDiv * eurRate : undefined, TIER.MANUAL, 'Add Data — EUR dividend × BNR');
  const usdDivRON = source(usdDiv ? usdDiv * usdRate : undefined, TIER.MANUAL, 'Add Data — USD dividend × BNR');
  const grossRON = sumPresent([xtbRon, btRon, eurDivRON, usdDivRON]);

  const xtbTax = source(xtbDiv.dividends?.taxWithheldRON, TIER.DOCUMENT, 'XTB Dividends');
  const btTax = source(btDiv.dividends?.taxWithheldRON, TIER.DOCUMENT, 'BT Capital Partners — Dividende');
  const eurTax = parseFloat(yd.roEurDivTaxPaid) || 0;
  const usdTax = parseFloat(yd.roUsdDivTaxPaid) || 0;
  const eurTaxRON = source(eurTax ? eurTax * eurRate : undefined, TIER.MANUAL, 'Add Data — EUR tax × BNR');
  const usdTaxRON = source(usdTax ? usdTax * usdRate : undefined, TIER.MANUAL, 'Add Data — USD tax × BNR');
  const taxWithheldRON = sumPresent([xtbTax, btTax, eurTaxRON, usdTaxRON]);

  // Country split: combine XTB.dividendsByCountry + BT.dividendsByCountry,
  // bucket by ISO code, tag broker provenance per source.
  //
  // - Romanian-source (country='RO') is surfaced as localGrossRON because
  //   if the Romanian broker withheld tax at source it is RO-source income
  //   for D205 / cap11 purposes (categ_venit=1006 may apply per Cod fiscal
  //   art. 7).
  // - Foreign-source (any non-RO ISO code) is surfaced as foreignByCountry,
  //   one bucket per country, for D212 cap14 (str_categ_venit=2018) emission.
  // - Unknown country (parser couldn't resolve, or manual Add-Data EUR/USD
  //   entries) is surfaced as unknownCountryRON. Downstream emitters MUST
  //   warn the user and skip XML emission for these — ANAF Schematron
  //   rule CD-D212-011 requires a valid str_stat_realiz_v code.
  const countryAccum = new Map();
  let localGrossRON = 0;
  let localTaxWithheldRON = 0;
  let unknownCountryRON = 0;
  let unknownCountryTaxRON = 0;
  let foreignTaxWithheldRON = 0;
  const mergeBuckets = (broker, buckets) => {
    for (const b of (buckets || [])) {
      const country = b.country || null;
      if (country === 'RO') {
        localGrossRON += b.grossRON || 0;
        localTaxWithheldRON += b.taxRON || 0;
        continue;
      }
      if (country === null) {
        unknownCountryRON += b.grossRON || 0;
        unknownCountryTaxRON += b.taxRON || 0;
        continue;
      }
      const acc = countryAccum.get(country) || {
        country,
        grossRON: 0, taxRON: 0, netRON: 0,
        sources: [],
      };
      acc.grossRON += b.grossRON || 0;
      acc.taxRON += b.taxRON || 0;
      acc.netRON += b.netRON || 0;
      acc.sources.push({ broker, grossRON: b.grossRON || 0, taxRON: b.taxRON || 0 });
      countryAccum.set(country, acc);
      foreignTaxWithheldRON += b.taxRON || 0;
    }
  };
  mergeBuckets('XTB', xtbDiv.dividendsByCountry);
  mergeBuckets('BT Capital Partners', btDiv.dividendsByCountry);
  const foreignByCountry = Array.from(countryAccum.values());

  // Manual Add-Data EUR/USD dividends have no country information. We keep
  // them in the legacy totals (grossRON, taxWithheldRON) but flag them as
  // unknownCountry so the UI can warn the user that they cannot be emitted
  // to the D212 XML until they re-enter them with a country.
  if (eurDivRON.present) unknownCountryRON += eurDivRON.value;
  if (usdDivRON.present) unknownCountryRON += usdDivRON.value;
  if (eurTaxRON.present) unknownCountryTaxRON += eurTaxRON.value;
  if (usdTaxRON.present) unknownCountryTaxRON += usdTaxRON.value;

  return {
    grossRON: grossRON.value,
    taxWithheldRON: taxWithheldRON.value,
    localGrossRON,
    localTaxWithheldRON,
    foreignByCountry,
    foreignTaxWithheldRON,
    unknownCountryRON,
    unknownCountryTaxRON,
    sources: { grossRON, taxWithheldRON },
  };
}

/**
 * Interest income (bank + RO broker + foreign).
 *
 * Reads:
 *   yd.adeverinta.interestIncome / interestTax  (bank adeverință, manual)
 *   yd.xtbDividendsReport.interest              (XTB Interest section)
 *   yd.roEurInterest / roUsdInterest + tax counterparts (manual EUR/USD)
 *   yd.form1042s[].incomeCode==='01'            (US-source interest)
 *   yd.interestIncome                           (override RON total)
 *   yd.interestTaxPaid                          (override RON tax)
 *
 * Returns `{incomeRON, taxWithheldRON, usForeignInterestRON, usForeignInterestTaxRON, sources}`.
 *
 * Notes:
 *  - US-source interest (1042-S code 01) is typically withheld at 0% per
 *    IRC §871(h) "portfolio interest exemption". As a RO fiscal resident
 *    the gross is still taxable in RO at the standard interest rate
 *    (10% / 16% from 2026); credit fiscal is whatever was actually
 *    withheld (usually 0).
 *  - `usForeignInterestRON` is surfaced separately so D212 cap14 can emit
 *    a categ_venit=2010 row without re-deriving it.
 */
function resolveInterest(yd, ctx) {
  yd = yd || {};
  ctx = ctx || {};
  const usdRate = ctx.usdRate || 1;
  const eurRate = ctx.eurRate || 1;
  const adv = yd.adeverinta || {};
  const xtbInt = (yd.xtbDividendsReport && yd.xtbDividendsReport.interest) || {};

  const form1042sInt = (yd.form1042s || []).filter(f => f.incomeCode === '01');
  const f1042sIntUSD = form1042sInt.reduce((s, f) => s + (f.grossIncomeUSD || 0), 0);
  const f1042sIntTaxUSD = form1042sInt.reduce((s, f) => s + (f.federalTaxWithheldUSD || 0), 0);

  // Bank-style base: `yd.interestIncome` (override) REPLACES `adv.interestIncome`
  // (manual entry from bank adeverință). Same for the matching tax field.
  // Foreign components are ALWAYS added on top, preserving the existing
  // semantic in _computeYearDataImpl where roInterestRON accumulates broker
  // sources separately from the bank base.
  const bankIncome = pickFirst([
    source(yd.interestIncome, TIER.OVERRIDE, 'Manual override'),
    source(adv.interestIncome, TIER.MANUAL, 'Add Data — adeverință'),
  ]);
  const bankTax = pickFirst([
    source(yd.interestTaxPaid, TIER.OVERRIDE, 'Manual override'),
    source(adv.interestTax, TIER.MANUAL, 'Add Data — adeverință'),
  ]);

  // Foreign income: XTB interest (parsed) + EUR / USD broker manual + US 1042-S.
  const xtbIntRON = source(xtbInt.grossRON, TIER.DOCUMENT, 'XTB Interest');
  const eurInt = parseFloat(yd.roEurInterest) || 0;
  const usdInt = parseFloat(yd.roUsdInterest) || 0;
  const eurIntRON = source(eurInt ? eurInt * eurRate : undefined, TIER.MANUAL, 'Add Data — EUR interest × BNR');
  const usdIntRON = source(usdInt ? usdInt * usdRate : undefined, TIER.MANUAL, 'Add Data — USD interest × BNR');
  const f1042sIntRON = source(f1042sIntUSD ? f1042sIntUSD * usdRate : undefined, TIER.DOCUMENT, '1042-S Interest (code 01)');
  const foreignIncome = sumPresent([xtbIntRON, eurIntRON, usdIntRON, f1042sIntRON]);

  // Foreign tax credit: EUR + USD broker manual + US 1042-S withholding only.
  // XTB-parsed `xtbInt.taxWithheldRON` is intentionally NOT included here —
  // historically the user is expected to enter that tax via the input that
  // fillInputWithImport pre-fills (saved to yd.interestTaxPaid). Adding it
  // automatically here would risk double-counting. This is a known gap that
  // the UI source-badge work (Phase 4) will surface explicitly.
  const eurIntTax = parseFloat(yd.roEurInterestTaxPaid) || 0;
  const usdIntTax = parseFloat(yd.roUsdInterestTaxPaid) || 0;
  const eurTaxRON = source(eurIntTax ? eurIntTax * eurRate : undefined, TIER.MANUAL, 'Add Data — EUR int. tax × BNR');
  const usdTaxRON = source(usdIntTax ? usdIntTax * usdRate : undefined, TIER.MANUAL, 'Add Data — USD int. tax × BNR');
  const f1042sTaxRON = source(f1042sIntTaxUSD ? f1042sIntTaxUSD * usdRate : undefined, TIER.DOCUMENT, '1042-S Interest tax');
  const foreignTax = sumPresent([eurTaxRON, usdTaxRON, f1042sTaxRON]);

  const incomeRON = bankIncome.value + foreignIncome.value;
  const taxWithheldRON = bankTax.value + foreignTax.value;

  return {
    incomeRON,
    taxWithheldRON,
    // Bank-style portion (adv.interestIncome or yd.interestIncome override)
    // and foreign portion (XTB + EUR + USD broker + 1042-S code 01) surfaced
    // separately because the existing income-breakdown renderer shows them
    // as distinct rows and the legacy `roInterestRON` field is referenced
    // in several places.
    bankIncomeRON: bankIncome.value,
    foreignIncomeRON: foreignIncome.value,
    bankTaxRON: bankTax.value,
    foreignTaxRON: foreignTax.value,
    usForeignInterestRON: f1042sIntUSD * usdRate,
    usForeignInterestTaxRON: f1042sIntTaxUSD * usdRate,
    sources: {
      // Composite source: pick the strongest tier among bank + foreign to
      // drive the UI badge. The label lists every contributor.
      incomeRON: (bankIncome.present || foreignIncome.present)
        ? {
            tier: bankIncome.present ? bankIncome.tier : foreignIncome.tier,
            label: [bankIncome.present ? bankIncome.label : null, foreignIncome.present ? foreignIncome.label : null].filter(Boolean).join(' + '),
            contributors: [bankIncome, foreignIncome].filter(s => s.present),
          }
        : { tier: null, label: null, contributors: [] },
      taxWithheldRON: (bankTax.present || foreignTax.present)
        ? {
            tier: bankTax.present ? bankTax.tier : foreignTax.tier,
            label: [bankTax.present ? bankTax.label : null, foreignTax.present ? foreignTax.label : null].filter(Boolean).join(' + '),
            contributors: [bankTax, foreignTax].filter(s => s.present),
          }
        : { tier: null, label: null, contributors: [] },
    },
  };
}

/**
 * US-source capital gains (RSU / ESPP sale through Fidelity / MS).
 *
 * Reads:
 *   yd.fidelityData.capitalGains   (Fidelity statement parsed)
 *   yd.fidelityTrades              (parsed trade confirmations)
 *   yd.declaratie.capitalGains     (ANAF or manual)
 *   yd.fidelityGains               (override, USD gross sale)
 *   yd.fidelityCost                (override, USD cost basis)
 *   yd.salaryTaxedIncome           (override, RON BIK deductible)
 *   ctx.yearAlloc.esppCostUSD      (FIFO allocation from ledger)
 *   ctx.trades                     (aggregated trade summary)
 *
 * Returns `{saleUSD, costUSD, taxableRON, salaryDeductionRON, sources}`.
 */
function resolveUsCapitalGains(yd, ctx) {
  yd = yd || {};
  ctx = ctx || {};
  const usdRate = ctx.usdRate || 1;
  const yearAlloc = ctx.yearAlloc || {};
  const trades = ctx.trades || {};
  const fd = yd.fidelityData || {};
  const fdCG = fd.capitalGains || {};
  const decl = yd.declaratie || {};
  const declCG = decl.capitalGains || {};
  const isAnaf = _hasAnafDecl(yd);

  const saleUSD = pickFirst([
    source(yd.fidelityGains, TIER.OVERRIDE, 'Manual override'),
    source(isAnaf ? declCG.saleUSD : undefined, TIER.ANAF_DOC, 'ANAF D212 import'),
    source(fdCG.saleUSD, TIER.DOCUMENT, 'Fidelity statement'),
    source(trades.totalProceeds, TIER.DOCUMENT, 'Trade confirmations'),
    source(!isAnaf ? declCG.saleUSD : undefined, TIER.MANUAL, 'Add Data — declarație'),
  ]);

  const costUSD = pickFirst([
    source(yd.fidelityCost, TIER.OVERRIDE, 'Manual override'),
    source(isAnaf ? declCG.costUSD : undefined, TIER.ANAF_DOC, 'ANAF D212 import'),
    source(fdCG.costUSD, TIER.DOCUMENT, 'Fidelity statement'),
    source(yearAlloc.esppCostUSD, TIER.DOCUMENT, 'FIFO ledger — ESPP cost basis'),
    source(!isAnaf ? declCG.costUSD : undefined, TIER.MANUAL, 'Add Data — declarație'),
  ]);

  const salaryDeductionRON = pickFirst([
    source(yd.salaryTaxedIncome, TIER.OVERRIDE, 'Manual override'),
    source(isAnaf ? declCG.salaryDeductionRON : undefined, TIER.ANAF_DOC, 'ANAF D212 import'),
    source(fdCG.salaryDeductionRON, TIER.DOCUMENT, 'Fidelity statement'),
    source(!isAnaf ? declCG.salaryDeductionRON : undefined, TIER.MANUAL, 'Add Data — declarație'),
  ]);

  // Taxable RON: prefer a directly reported value; otherwise derive.
  const taxablePick = pickFirst([
    source(isAnaf ? declCG.taxableRON : undefined, TIER.ANAF_DOC, 'ANAF D212 import'),
    source(fdCG.taxableRON, TIER.DOCUMENT, 'Fidelity statement'),
    source(!isAnaf ? declCG.taxableRON : undefined, TIER.MANUAL, 'Add Data — declarație'),
  ]);
  const taxableRON = taxablePick.present
    ? taxablePick
    : deriveValue(
        Math.max(0, ((saleUSD.value || 0) - (costUSD.value || 0)) * usdRate),
        [saleUSD, costUSD],
        `(saleUSD − costUSD) × BNR ${usdRate}`,
      );

  return {
    saleUSD: saleUSD.value,
    costUSD: costUSD.value,
    taxableRON: taxableRON.value,
    salaryDeductionRON: salaryDeductionRON.value,
    sources: { saleUSD, costUSD, taxableRON, salaryDeductionRON },
  };
}

/**
 * Romania-broker capital gains (XTB + Tradeville + BT Capital Partners +
 * manual countries).
 *
 * Reads:
 *   yd.xtbPortfolio.{long,short}Term.{gain,loss}RON   (XTB Portfolio PDF)
 *   yd.tradevillePortfolio.{long,short}Term.{gain,loss}RON
 *   yd.btPortfolio.{long,short}Term.{gain,loss}RON    (BT Capital Partners)
 *   yd.roGainsCountries                              (manual per-country array)
 *   yd.roGainsLong / roGainsShort                    (legacy single-field overrides)
 *   yd.roGainsTaxWithheld                            (legacy tax override)
 *
 * Returns `{longGainRON, shortGainRON, totalGainRON, taxWithheldRON, currentYearLossRON, sources}`.
 *
 * Notes:
 *  - Romanian fiscal rules tax NET (gain − loss) per holding-period bucket
 *    within the year. A net loss in either bucket carries forward.
 *  - The manual `roGainsCountries` array currently REPLACES (not adds to)
 *    the XTB/Tradeville/BT parsed totals — preserving existing semantics.
 *    This is "Tier 2 ANAF_DOC-equivalent" in spirit (user explicitly set
 *    detailed per-country breakdown), so it overrides the parsed sum.
 */
function resolveRoBrokerGains(yd, ctx) {
  yd = yd || {};
  ctx = ctx || {};
  const usdRate = ctx.usdRate || 1;
  const eurRate = ctx.eurRate || 1;
  const xtbPort = yd.xtbPortfolio || {};
  const tvPort = yd.tradevillePortfolio || {};
  const btPort = yd.btPortfolio || {};

  // Per-country manual override branch: replaces parsed totals.
  if (Array.isArray(yd.roGainsCountries) && yd.roGainsCountries.length > 0) {
    let longSum = 0, shortSum = 0, taxSum = 0;
    for (const c of yd.roGainsCountries) {
      const cur = (c.currency || 'RON').toUpperCase();
      const fx = cur === 'EUR' ? eurRate : (cur === 'USD' ? usdRate : 1);
      longSum += (c.longGain || 0) * fx;
      shortSum += (c.shortGain || 0) * fx;
      taxSum += (c.taxWithheld || 0) * fx;
    }
    const ovLong = source(longSum, TIER.OVERRIDE, 'Per-country manual entries');
    const ovShort = source(shortSum, TIER.OVERRIDE, 'Per-country manual entries');
    const ovTax = source(taxSum, TIER.OVERRIDE, 'Per-country manual entries');
    return {
      longGainRON: ovLong.value,
      shortGainRON: ovShort.value,
      totalGainRON: ovLong.value + ovShort.value,
      taxWithheldRON: ovTax.value,
      currentYearLossRON: 0,
      sources: {
        longGainRON: ovLong,
        shortGainRON: ovShort,
        taxWithheldRON: ovTax,
      },
    };
  }

  // Legacy single-field overrides (kept for backward compat — used by the
  // old UI before per-country rows existed).
  const ovLong = source(yd.roGainsLong, TIER.OVERRIDE, 'Manual override (legacy)');
  const ovShort = source(yd.roGainsShort, TIER.OVERRIDE, 'Manual override (legacy)');
  const ovTax = source(yd.roGainsTaxWithheld, TIER.OVERRIDE, 'Manual override (legacy)');

  const xtbLongGain = source(xtbPort.longTerm?.gainRON, TIER.DOCUMENT, 'XTB Portfolio long');
  const xtbLongLoss = source(xtbPort.longTerm?.lossRON, TIER.DOCUMENT, 'XTB Portfolio long loss');
  const xtbShortGain = source(xtbPort.shortTerm?.gainRON, TIER.DOCUMENT, 'XTB Portfolio short');
  const xtbShortLoss = source(xtbPort.shortTerm?.lossRON, TIER.DOCUMENT, 'XTB Portfolio short loss');
  const tvLongGain = source(tvPort.longTerm?.gainRON, TIER.DOCUMENT, 'Tradeville long');
  const tvLongLoss = source(tvPort.longTerm?.lossRON, TIER.DOCUMENT, 'Tradeville long loss');
  const tvShortGain = source(tvPort.shortTerm?.gainRON, TIER.DOCUMENT, 'Tradeville short');
  const tvShortLoss = source(tvPort.shortTerm?.lossRON, TIER.DOCUMENT, 'Tradeville short loss');
  const btLongGain = source(btPort.longTerm?.gainRON, TIER.DOCUMENT, 'BT Capital Partners long');
  const btLongLoss = source(btPort.longTerm?.lossRON, TIER.DOCUMENT, 'BT Capital Partners long loss');
  const btShortGain = source(btPort.shortTerm?.gainRON, TIER.DOCUMENT, 'BT Capital Partners short');
  const btShortLoss = source(btPort.shortTerm?.lossRON, TIER.DOCUMENT, 'BT Capital Partners short loss');

  // Bucket nets: per-bucket sum of gains minus losses across brokers.
  const longNet =
    (xtbLongGain.value || 0) - (xtbLongLoss.value || 0) +
    (tvLongGain.value || 0) - (tvLongLoss.value || 0) +
    (btLongGain.value || 0) - (btLongLoss.value || 0);
  const shortNet =
    (xtbShortGain.value || 0) - (xtbShortLoss.value || 0) +
    (tvShortGain.value || 0) - (tvShortLoss.value || 0) +
    (btShortGain.value || 0) - (btShortLoss.value || 0);

  const longGainResolved = ovLong.present ? ovLong : sumPresent([xtbLongGain, tvLongGain, btLongGain]);
  const shortGainResolved = ovShort.present ? ovShort : sumPresent([xtbShortGain, tvShortGain, btShortGain]);

  const longGainRON = ovLong.present ? ovLong.value : Math.max(0, longNet);
  const shortGainRON = ovShort.present ? ovShort.value : Math.max(0, shortNet);
  const currentYearLossRON = (ovLong.present || ovShort.present)
    ? 0
    : Math.max(0, -longNet) + Math.max(0, -shortNet);

  const taxRes = ovTax.present
    ? ovTax
    : sumPresent([
        source(xtbPort.totalTaxWithheldRON, TIER.DOCUMENT, 'XTB Portfolio tax'),
        source(tvPort.totalTaxWithheldRON, TIER.DOCUMENT, 'Tradeville tax'),
        source(btPort.totalTaxWithheldRON, TIER.DOCUMENT, 'BT Capital Partners tax'),
      ]);

  return {
    longGainRON,
    shortGainRON,
    totalGainRON: longGainRON + shortGainRON,
    taxWithheldRON: taxRes.value,
    currentYearLossRON,
    sources: {
      longGainRON: longGainResolved,
      shortGainRON: shortGainResolved,
      taxWithheldRON: taxRes,
    },
  };
}

/**
 * Salary-equivalent income from RSU vesting + ESPP discount (Beneficii In
 * Natură = BIK). Drives the cost-basis deduction on capital gains (`Rd.2`
 * Cheltuieli deductibile) and the withholding-already-paid offset.
 *
 * Reads:
 *   ctx.yearAwards[]              (stock awards filtered to the fiscal year)
 *   yd.salaryTaxedIncome          (override, RON BIK)
 *   yd.stockWithholdingPaid       (override, RON withholding)
 *
 * Returns `{taxedRON, withholdingRON, sources}`.
 */
function resolveSalaryBIK(yd, ctx) {
  yd = yd || {};
  ctx = ctx || {};
  const yearAwards = ctx.yearAwards || [];

  const taxedFromAwards = yearAwards.reduce(
    (s, r) => s + (parseFloat(r.stock_award_bik) || 0) + (parseFloat(r.espp_gain_bik) || 0),
    0,
  );
  const withholdingFromAwards = yearAwards.reduce(
    (s, r) => s + (parseFloat(r.stock_withholding) || 0),
    0,
  );

  const taxed = pickFirst([
    source(yd.salaryTaxedIncome, TIER.OVERRIDE, 'Manual override'),
    source(
      taxedFromAwards || (yearAwards.length > 0 ? 0 : undefined),
      TIER.DOCUMENT,
      'FIFO ledger — vest + ESPP BIK',
      { present: yearAwards.length > 0 },
    ),
  ]);

  const withholding = pickFirst([
    source(yd.stockWithholdingPaid, TIER.OVERRIDE, 'Manual override'),
    source(
      withholdingFromAwards || (yearAwards.length > 0 ? 0 : undefined),
      TIER.DOCUMENT,
      'FIFO ledger — payroll withholding',
      { present: yearAwards.length > 0 },
    ),
  ]);

  return {
    taxedRON: taxed.value,
    withholdingRON: withholding.value,
    sources: { taxedRON: taxed, withholdingRON: withholding },
  };
}

const _exports = {
  resolveUsDividends,
  resolveRoBrokerDividends,
  resolveInterest,
  resolveUsCapitalGains,
  resolveRoBrokerGains,
  resolveSalaryBIK,
};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = _exports;
}
if (typeof window !== 'undefined') {
  window.IncomeResolvers = _exports;
}

})();
