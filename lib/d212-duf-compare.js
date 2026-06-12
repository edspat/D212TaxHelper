/**
 * DUF vs. local cross-checker.
 *
 * Given a parsed D212 XML downloaded from the ANAF DUF portal (`anaf`) and
 * the structured data we compute locally from broker PDFs (`local`), this
 * module produces a flat list of comparison rows the UI can render as a
 * side-by-side table.
 *
 * Each row carries:
 *   * label    — Romanian description (matches what the user sees in DUF)
 *   * section  — 'oblig' / 'cap11' / 'cap14' for grouping in the UI
 *   * anaf     — number or null (what ANAF reports)
 *   * local    — number or null (what we compute)
 *   * delta    — anaf - local, signed
 *   * status   — 'match' / 'near' / 'mismatch' / 'only-anaf' / 'only-local'
 *   * hint     — optional short explanation for the user (Romanian)
 *
 * The headline (top-level status of the whole comparison) is the worst
 * row status, with the standard precedence:
 *   match < near < mismatch
 * Plus the structural-only states:
 *   only-anaf  → ANAF has data we don't (we forgot to import something)
 *   only-local → we computed data ANAF doesn't have (we have to add it in DUF)
 *
 * Both structural states elevate the headline to 'partial' unless there are
 * also numeric mismatches in which case the headline is 'mismatch'.
 *
 * Classification thresholds (`MATCH_EPS`, `NEAR_ABS`, `NEAR_REL`) live as
 * module constants so the UI / tests have a single source of truth.
 */

'use strict';

const { getCategory } = require('./d205-categories');

const MATCH_EPS = 1;          // <= 1 RON difference → match (absolute)
const NEAR_ABS = 100;         // <= 100 RON → near (absolute)
const NEAR_REL = 0.01;        // OR <= 1% of max(anaf, local) → near

/** Threshold-driven classifier for a single numeric pair. */
function classify(anaf, local) {
  if (anaf == null && local == null) return 'match';
  if (anaf == null) return 'only-local';
  if (local == null) return 'only-anaf';
  const a = Number(anaf) || 0;
  const l = Number(local) || 0;
  const delta = Math.abs(a - l);
  if (delta <= MATCH_EPS) return 'match';
  const denom = Math.max(Math.abs(a), Math.abs(l), 1);
  if (delta <= NEAR_ABS || delta / denom <= NEAR_REL) return 'near';
  return 'mismatch';
}

function buildHint(status, anaf, local, label, isPfa) {
  if (status === 'match') return null;
  if (status === 'only-anaf') {
    if (isPfa) {
      return 'ANAF are aceste date din declarațiile PFA / D205 anterioare. Aplicația noastră nu calculează PFA — folosește valorile ANAF în DUF.';
    }
    return 'ANAF a primit suma asta prin D205 de la un plătitor (broker / bancă). Verifică dacă ai documentul corespunzător; dacă nu, importă-l în „Adaugă date".';
  }
  if (status === 'only-local') {
    return 'Tu ai calculat această sumă local (de obicei din PDF-uri broker pentru venituri din străinătate). ANAF nu o are — trebuie adăugată manual în DUF.';
  }
  if (status === 'near') {
    const delta = Math.round((local || 0) - (anaf || 0));
    return `Diferență mică (~${Math.abs(delta)} RON). Probabil rotunjire. Verifică totuși dacă valoarea broker = valoarea ANAF.`;
  }
  // mismatch
  const delta = Math.round((local || 0) - (anaf || 0));
  return `Diferență ${delta > 0 ? '+' : ''}${delta} RON între local și ANAF. Verifică PDF-ul broker; eventual D205 a fost depusă greșit de plătitor.`;
}

/** Convert a numeric attribute that might be a string from XML. */
function num(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Stable key for a comparison row — used by the UI to persist per-row picks. */
function rowKeyFor(section, opts) {
  const o = opts || {};
  if (section === 'oblig') return `oblig.${o.field}`;
  if (section === 'cap11') return `cap11.${o.code || '?'}.${o.field}`;
  if (section === 'cap14') return `cap14.${o.country || '?'}.${o.code || '?'}.${o.field}`;
  return `${section}.${o.field || '?'}`;
}

/**
 * Default decision per row given its status. The UI uses this when the
 * user hasn't made an explicit pick yet.
 *   match     → 'local'   (sides are equal, default to our calc for traceability)
 *   near      → 'local'   (rounding-class delta; our calc is the precise one)
 *   mismatch  → null      (UI must force the user to decide)
 *   only-anaf → 'anaf'    (we don't have it locally; ANAF is the source)
 *   only-local→ 'local'   (ANAF doesn't have it; only we do — must add to DUF)
 */
function defaultPickFor(status) {
  if (status === 'only-anaf') return 'anaf';
  if (status === 'mismatch') return null;
  return 'local';
}

/** Push one comparison row only if at least one of (anaf, local) has a value. */
function pushRow(out, section, label, anaf, local, opts) {
  const a = num(anaf);
  const l = num(local);
  if (a == null && l == null) return;
  const status = classify(a, l);
  const hint = buildHint(status, a, l, label, opts && opts.isPfa);
  out.push({
    section,
    label,
    rowKey: rowKeyFor(section, opts || {}),
    anaf: a,
    local: l,
    delta: a != null && l != null ? Math.round((a || 0) - (l || 0)) : null,
    status,
    hint,
    defaultPick: defaultPickFor(status),
  });
}

/**
 * Build the full comparison from parsed ANAF data + local compute output.
 *
 * @param {object} anaf    The output of `parseD212Xml` (or any equivalent shape:
 *                         {root?, obligRealizat?, cap11: [...], cap14: [...]})
 * @param {object} local   Either the full output of `computeYearData` (which
 *                         carries `obligRealizat`, `cap11Rows`, `cap14Rows`)
 *                         or a minimal `{obligRealizat?, cap11Rows: [], cap14Rows: []}` shape.
 * @returns {{
 *   rows: Array<object>,
 *   totals: { matchCount: number, nearCount: number, mismatchCount: number, onlyAnafCount: number, onlyLocalCount: number },
 *   headline: 'match' | 'near' | 'partial' | 'mismatch',
 * }}
 */
function compareDufVsLocal(anaf, local) {
  const rows = [];
  const a = anaf || {};
  const l = local || {};

  // 1. oblig_realizat — investment totals + CASS
  const ao = a.obligRealizat || {};
  const lo = l.obligRealizat || {};
  pushRow(rows, 'oblig', 'Total venit din investiții (cass_ven_inv)', ao.cass_ven_inv, lo.cass_ven_inv, { field: 'cass_ven_inv' });
  pushRow(rows, 'oblig', 'Bază CASS (cass_baza)', ao.cass_baza, lo.cass_baza, { field: 'cass_baza' });
  pushRow(rows, 'oblig', 'CASS datorat (cass_datorat)', ao.cass_datorat, lo.cass_datorat, { field: 'cass_datorat' });
  pushRow(rows, 'oblig', 'Impozit pe venit de plată (impozit_venit_plus)', ao.impozit_venit_plus, lo.impozit_venit_plus, { field: 'impozit_venit_plus' });
  pushRow(rows, 'oblig', 'Impozit pe venit de restituit (impozit_venit_minus)', ao.impozit_venit_minus, lo.impozit_venit_minus, { field: 'impozit_venit_minus' });

  // 2. cap11 — match rows by categ_venit. PFA codes (10xx that we don't compute)
  //    surface as only-anaf with a friendly hint.
  const a11 = Array.isArray(a.cap11) ? a.cap11 : [];
  const l11 = Array.isArray(l.cap11Rows) ? l.cap11Rows : [];
  const seenCodes = new Set();
  for (const r of a11) {
    const code = String(r.categ_venit || '');
    seenCodes.add(code);
    const lRow = l11.find((x) => String(x.categ_venit || '') === code);
    const isPfa = code.startsWith('10') && code !== '1012';   // 1012 is investments (capgains)
    const label = isPfa
      ? `Cap11 PFA / activități independente (cod ${code})`
      : `Câștiguri RO din titluri (cod ${code})`;
    pushRow(rows, 'cap11', label, r.venit_net_anual, lRow ? lRow.venit_net_anual : null, { isPfa, code, field: 'venit_net_anual' });
    if (r.impozit_retinut != null || (lRow && lRow.impozit_retinut != null)) {
      pushRow(rows, 'cap11', `Impozit reținut RO (cod ${code})`, r.impozit_retinut, lRow ? lRow.impozit_retinut : null, { isPfa, code, field: 'impozit_retinut' });
    }
  }
  // Local-only cap11 rows
  for (const r of l11) {
    const code = String(r.categ_venit || '');
    if (seenCodes.has(code)) continue;
    pushRow(rows, 'cap11', `Câștiguri RO din titluri (cod ${code})`, null, r.venit_net_anual, { code, field: 'venit_net_anual' });
  }

  // 3. cap14 — match by (country, category) tuple.
  const a14 = Array.isArray(a.cap14) ? a.cap14 : [];
  const l14 = Array.isArray(l.cap14Rows) ? l.cap14Rows : [];
  const keyOf = (r) => `${r.str_stat_realiz_v || '?'}:${r.str_categ_venit || '?'}`;
  const seenKeys = new Set();
  for (const r of a14) {
    const k = keyOf(r);
    seenKeys.add(k);
    const lRow = l14.find((x) => keyOf(x) === k);
    const cat = getCategory(r.str_categ_venit);
    const catLabel = (cat && cat.kind === 'capgains-long') ? 'capgains ≥1y'
                   : (cat && cat.kind === 'capgains-short') ? 'capgains <1y'
                   : `cod ${r.str_categ_venit}`;
    const label = `Venit străinătate ${r.str_stat_realiz_v || '?'} — ${catLabel}`;
    const country = String(r.str_stat_realiz_v || '?');
    const code = String(r.str_categ_venit || '?');
    pushRow(rows, 'cap14', label, r.str_venit_net_anual, lRow ? lRow.str_venit_net_anual : null, { country, code, field: 'str_venit_net_anual' });
    pushRow(rows, 'cap14', `${label} — credit fiscal`, r.str_credit_fiscal, lRow ? lRow.str_credit_fiscal : null, { country, code, field: 'str_credit_fiscal' });
  }
  for (const r of l14) {
    const k = keyOf(r);
    if (seenKeys.has(k)) continue;
    const country = String(r.str_stat_realiz_v || '?');
    const code = String(r.str_categ_venit || '?');
    pushRow(rows, 'cap14', `Venit străinătate ${country} — cod ${code}`, null, r.str_venit_net_anual, { country, code, field: 'str_venit_net_anual' });
  }

  // Totals + headline
  const totals = { matchCount: 0, nearCount: 0, mismatchCount: 0, onlyAnafCount: 0, onlyLocalCount: 0 };
  for (const row of rows) {
    if (row.status === 'match') totals.matchCount++;
    else if (row.status === 'near') totals.nearCount++;
    else if (row.status === 'mismatch') totals.mismatchCount++;
    else if (row.status === 'only-anaf') totals.onlyAnafCount++;
    else if (row.status === 'only-local') totals.onlyLocalCount++;
  }
  let headline = 'match';
  if (totals.mismatchCount > 0) headline = 'mismatch';
  else if (totals.onlyAnafCount > 0 || totals.onlyLocalCount > 0) headline = 'partial';
  else if (totals.nearCount > 0) headline = 'partial';

  return { rows, totals, headline };
}

module.exports = {
  compareDufVsLocal,
  classify,
  rowKeyFor,
  defaultPickFor,
  MATCH_EPS,
  NEAR_ABS,
  NEAR_REL,
};
