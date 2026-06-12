/**
 * D212 `<oblig_realizat>` block builder (CASS for investment income).
 *
 * The `<oblig_realizat>` element is a single, attribute-heavy child of
 * `<d212>` that carries:
 *   * Cap. I — Section 1 last sub-section: real impozit + CAS + CASS
 *     calculations for activities the taxpayer ran in Romania.
 *   * Cap. I — Section 3 totals: the global "to pay" / "to refund" sums
 *     that the ANAF system uses to issue debit/credit notes.
 *
 * Most attributes are oriented at PFA / activitati independente (AI) and
 * drepturi de proprietate intelectuala (DPI). Our app focuses on the
 * INVESTMENT subset (CASS for dividends + capital gains + interest), which
 * the form exposes through `cass_ven_inv` + the global CASS block.
 *
 * Reference documentation
 * -----------------------
 * * `docs/anaf/d212-2025/D212.xsd` lines 168-1430 — full attribute list.
 *   BT codes BT-01018..BT-01030 cover the CASS-base and CASS-due fields.
 * * The donor's anonymized fixture in `test/fixtures/d212-sample-anaf.xml`
 *   shows the exact emission style for an investor with also-PFA income.
 *
 * Scope of THIS first pass (paired with etapa 2 of the DUF integration plan)
 * --------------------------------------------------------------------------
 * We emit ONLY the investment-relevant attributes and the global summary.
 * AI/DPI/CFB-specific attributes (cass_total_ven_ai, baza_cass_datorat_ai,
 * real_*_ai, etc.) are deliberately OMITTED — those numbers come from the
 * DUF-pre-filled portion of the user's XML, not from our compute. The
 * future import-merge feature (etapa 3) will preserve them by keeping
 * whatever attributes the imported XML already carries.
 *
 * Bifa flags
 * ----------
 * When this block is present, the XML builder derives `bifa132=1` (CASS
 * datorat section exists). `bifa14` (AI tax in sistem real) stays at 0 —
 * that's a PFA flag we never set ourselves.
 */

'use strict';

/**
 * Build the attribute map for `<oblig_realizat>` from a `computeYearData`
 * result. Returns null when there is nothing investment-related to declare,
 * in which case the XML builder skips the element entirely.
 *
 * @param {object} data  Output of computeYearData(year).
 * @returns {object|null}
 */
function buildObligRealizat(data) {
  if (!data) return null;

  const cassVenInv = Math.max(0, data.totalIncome_cass || 0);
  const cassInfo = data.cassInfo || {};
  const cassApplies = !!cassInfo.applies;
  const cassBase = cassApplies ? (cassInfo.base || 0) : 0;
  const cassAmount = cassApplies ? (cassInfo.amount || 0) : 0;
  const incomeTax = Math.max(0, data.incomeTaxOnly || 0);
  const refundOwed = Math.max(0, data.refundOwedRON || 0);

  // Nothing to declare: the user has no investment income, no CASS due,
  // and no tax delta to surface. The XML emitter will skip the element.
  if (cassVenInv === 0 && cassAmount === 0 && incomeTax === 0 && refundOwed === 0) {
    return null;
  }

  // impozit_venit_plus / minus: the form represents the income-tax delta as
  // a signed pair. Plus = tax owed, minus = refund from RO payer
  // over-withholding (foreign-tax over-credit is NOT refundable via D212).
  const impozit_venit_plus = incomeTax;
  const impozit_venit_minus = refundOwed;

  // cass_plus / cass_minus: investment CASS is never withheld at source by
  // RO brokers (different from income tax), so cass_minus is always 0 here.
  const cass_plus = cassAmount;
  const cass_minus = 0;

  // dif_de_plata / dif_de_restituit are SUMS of the *_plus / *_minus pairs
  // across all category groups (income tax + CAS + CASS). For an investor
  // with no CAS owed and no AI, cas_plus = 0 and the formulas reduce to:
  //    dif_de_plata    = impozit_venit_plus  + cass_plus
  //    dif_de_restituit = impozit_venit_minus + cass_minus
  const dif_de_plata = impozit_venit_plus + cass_plus;
  const dif_de_restituit = impozit_venit_minus + cass_minus;

  return {
    // CASS — Cap. I § 1 — investment income subject to the health contribution
    cass_ven_dpi: 0,
    cass_ven_asc: 0,
    cass_ven_cfb: 0,
    cass_ven_inv: Math.round(cassVenInv),
    cass_ven_asp: 0,
    cass_ven_alt: 0,
    cass_total_ven: Math.round(cassVenInv),
    cass_baza: Math.round(cassBase),
    cass_anuala: Math.round(cassAmount),
    cass_datorat_art180: 0,
    cass_datorat: Math.round(cassAmount),
    cass_retinut: 0,
    cass_dif_plus: Math.round(cassAmount),
    cass_dif_minus: 0,

    // Bifa pentru opțiunea de calcul real (3 = "sistem real, plafonat la
    // 24 SM" — default for pure investment income per Cod fiscal art. 174).
    bifa_cass_real: '3',

    // Global summary (Cap. I § 3)
    impozit_venit_plus: Math.round(impozit_venit_plus),
    impozit_venit_minus: Math.round(impozit_venit_minus),
    cas_plus: 0,
    cass_plus: Math.round(cass_plus),
    cass_minus: Math.round(cass_minus),
    dif_de_plata: Math.round(dif_de_plata),
    dif_de_restituit: Math.round(dif_de_restituit),
    venit_ret_inv: Math.round(cassVenInv),
  };
}

module.exports = { buildObligRealizat };
