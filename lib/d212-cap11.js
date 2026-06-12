/**
 * D212 Cap. I §1.1 — `cap11` (Romanian-source income, real system) row builder.
 *
 * This module produces the structured rows that map directly onto the cap11
 * element defined in docs/anaf/d212-2025/D212.xsd (BG-03000 / BG-03100). Each
 * row carries the 9 financial fields (Rd.1..Rd.9) plus the categ_venit code
 * required by the schematron rule CD-D212-015.
 *
 * Why this module exists
 * ----------------------
 * The browser-side `computeYearData` in public/js/app.js already produces all
 * the numbers the form needs; the structured shape lets the (eventual) D-7
 * XML emitter consume them without re-deriving from scratch, and gives the
 * UI a single place to render the user's cap11 declaration view.
 *
 * Scope of this first pass (D-6)
 * ------------------------------
 * - Capital gains via XTB / Tradeville / BT Trade / manual entry. ONE row with
 *   categ_venit = '1012'. The Schematron rule BR-D212-0085 enforces uniqueness
 *   of categ_venit=1012 in the whole declaration, so we aggregate long- and
 *   short-term buckets into a single row even though they are taxed at
 *   different rates (1% / 3% for 2023-2025, 3% / 6% for 2026+).
 * - Dividends and interest with "impozit final" (broker withholding at source)
 *   are NOT emitted on cap11 — they have no entry in Nomenclator_venituri_RO
 *   for individuals. They show up on the CASS base (Cap. II) only.
 *
 * Field semantics (matching Instr. D212 § 7.3, OMF 2736/2025)
 * ----------------------------------------------------------
 * Rd.1  venit_brut          = total gross gain (post per-bucket netting in this
 *                             pass — see Gap D-5 in ROADMAP for cross-bucket
 *                             refactor). Currency: RON, rounded.
 * Rd.2  chelt_deduc         = 0 for capital gains (no deductible expenses;
 *                             cost basis is already netted into gain).
 * Rd.3  venit_net_anual     = Rd.1 - Rd.2.
 * Rd.4  pierdere            = annual loss carried forward to next year's
 *                             pierdere_precedenta. Set from currentYearLossRON
 *                             (the cross-bucket residual loss after within-
 *                             year netting).
 * Rd.5  pierdere_precedenta = prior-year losses available (from yd.priorLosses
 *                             input, max 7 years per Cod fiscal art. 119).
 * Rd.6  pierdere_compensata = prior losses applied this year =
 *                             min(Rd.5, 0.70 × Rd.3) — Instr. § 7.3.3.
 * Rd.7  venit_recalculat    = Rd.3 - Rd.6 = taxable income.
 * Rd.8  impozit11           = recomputed tax = sum(bucket gain × bucket rate),
 *                             matching the broker's "impozit final" calculation.
 * Rd.9  impozit_retinut     = total tax withheld at source by the RO broker.
 *
 * The corresponding mirror logic lives inline in
 *   public/js/app.js: computeYearData (search for "cap11Rows")
 * to keep the browser bundle dependency-free. Tests cover this canonical lib
 * version; the inline copy is verified by visual inspection + the
 * server-side D-7 XML emitter (planned) will call this lib directly.
 */

'use strict';

/**
 * Build the cap11 rows for a given year of computed data.
 *
 * @param {object} input
 * @param {number} input.roLongTermGainRON   Long-term (≥1y) gain after within-year netting (always ≥ 0)
 * @param {number} input.roShortTermGainRON  Short-term (<1y) gain after within-year netting (always ≥ 0)
 * @param {number} [input.currentYearLossRON=0]  Cross-bucket residual loss to carry forward
 * @param {number} [input.priorLossesAvailable=0]  yd.priorLosses input (Rd.5)
 * @param {number} [input.priorLossesApplied=0]    Computed compensation (Rd.6)
 * @param {number} [input.roCapitalGainsTax=0]     Recomputed tax = sum(bucket × rate) (Rd.8)
 * @param {number} [input.roPortTaxWithheld=0]     Broker-withheld tax (Rd.9)
 * @returns {Array<object>} Zero or one cap11 row.
 */
function buildCap11Rows(input) {
  const {
    roLongTermGainRON = 0,
    roShortTermGainRON = 0,
    currentYearLossRON = 0,
    priorLossesAvailable = 0,
    priorLossesApplied = 0,
    roCapitalGainsTax = 0,
    roPortTaxWithheld = 0,
  } = input || {};

  const rows = [];
  const totalGain = roLongTermGainRON + roShortTermGainRON;

  // Emit only if there is *something* RO-source to declare. A user with no
  // RO broker activity gets an empty array → the XML emitter omits cap11
  // entirely and sets bifa111=0 (per BR-D212-0007).
  if (totalGain <= 0 && currentYearLossRON <= 0 && roPortTaxWithheld <= 0 && priorLossesAvailable <= 0) {
    return rows;
  }

  const Rd1 = totalGain;
  const Rd2 = 0;
  const Rd3 = Rd1 - Rd2;
  const Rd4 = currentYearLossRON;
  const Rd5 = priorLossesAvailable;
  const Rd6 = priorLossesApplied;
  const Rd7 = Math.max(0, Rd3 - Rd6);
  const Rd8 = roCapitalGainsTax;
  const Rd9 = roPortTaxWithheld;

  rows.push({
    categ_venit: '1012',
    den_venit: 'Câștiguri din transferul titlurilor de valoare',
    venit_brut: Math.round(Rd1),
    chelt_deduc: Math.round(Rd2),
    venit_net_anual: Math.round(Rd3),
    pierdere: Math.round(Rd4),
    pierdere_precedenta: Math.round(Rd5),
    pierdere_compensata: Math.round(Rd6),
    venit_recalculat: Math.round(Rd7),
    impozit11: Math.round(Rd8),
    impozit_retinut: Math.round(Rd9),
  });
  return rows;
}

module.exports = { buildCap11Rows };
