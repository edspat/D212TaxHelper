/**
 * D212 XML builder — produces a partial D212 XML document conforming to
 * docs/anaf/d212-2025/D212.xsd v1.0.4. The output can be imported into the
 * official ANAF PDF form, after which the user fills in personal data
 * (nume_c, prenume_c, cif, nerezident, cont_bancar) and submits via SPV.
 *
 * Why a builder, not a template
 * -----------------------------
 * The XSD has 280+ attributes spread across 8 root + 7 capitol elements.
 * Many are conditional (BR-D212-* schematron rules cross-check presence,
 * value, and consistency). A string template is brittle. This builder lets
 * us emit only the attributes we have values for and rely on the schematron
 * to flag what's missing when the user imports.
 *
 * Scope (first pass D-7)
 * ----------------------
 * Emits:
 *   - <d212> root with all *required* boolean flags (bifa*) computed from
 *     the presence/absence of capitols + 0 placeholders for the others.
 *   - <cap11> elements from cap11Rows[] (categ_venit=1012).
 *   - <cap14> elements from cap14Rows[].
 *
 * Does NOT emit:
 *   - <cap12>, <cap13>, <cap19>, <cap23> — not in scope for investment
 *     income workflow.
 *   - <oblig_realizat> CASS block — handled by ANAF tool from cap11/cap14.
 *   - Personal data attributes — placeholders that the user MUST replace
 *     before importing. A leading comment lists them clearly.
 *
 * Schematron note: the resulting XML will FAIL some rules (CNP validity,
 * IBAN checksum) until the placeholders are replaced. That's by design —
 * the user does this step in the ANAF tool, not here.
 */

'use strict';

const NAMESPACE = 'mfp:anaf:dgti:d212:declaratie:v11';

// Schema version we target. The ANAF DUF portal emits this header so the
// PDF validator can pick the right business rules when re-importing.
// Update when docs/anaf/d212-2025/D212.xsd is refreshed.
const SCHEMA_VERSION = 'V-1.8.09 / 15.05.2026';

// cap11 attributes that the ANAF DUF portal omits when they are zero-valued.
// "Calculated outputs" (venit_net_anual, pierdere_compensata, venit_recalculat)
// are kept even when zero so the PDF tool sees them explicitly. "User inputs"
// (Rd.1 venit_brut, Rd.2 chelt_deduc, Rd.4 pierdere, Rd.5 pierdere_precedenta,
// Rd.8 impozit11, Rd.9 impozit_retinut) are dropped when zero.
const CAP11_OMIT_IF_ZERO = new Set([
  'venit_brut', 'chelt_deduc', 'pierdere', 'pierdere_precedenta',
  'impozit11', 'impozit_retinut',
]);

// cap14 follows the same input/output split. Calculated outputs always
// emitted: str_venit_net_anual, str_pierdere_compensata, str_venit_recalculat,
// str_credit_fiscal, str_dif_impozit_datorat. Inputs dropped when zero.
const CAP14_OMIT_IF_ZERO = new Set([
  'str_venit_brut', 'str_chelt_deduc', 'str_pierdere_anuala',
  'str_pierdere_precedenta', 'str_impozit_datorat_Ro', 'str_impozit_platit',
]);

// Decorative attributes never emitted — codes are sufficient; the ANAF tool
// renders labels from its own nomenclator lookup. Dropping reduces noise.
const NEVER_EMIT_ATTRS = new Set([
  'den_venit', 'den_stat', 'den_categ_venit',
]);

/**
 * Escape characters that have XML meaning. Per XSD, all string-type attrs
 * accept arbitrary text up to maxLength; the builder is responsible for
 * encoding `<`, `>`, `&`, `"`, `'` so the document parses.
 */
function xmlEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format an attribute list as ` k1="v1" k2="v2"`. Omits entries where the
 * value is null/undefined. Numbers are emitted as integers (XSD types
 * N15Type / N5Type require no decimal point for our fields).
 *
 * @param {object} map
 * @param {object} [opts]
 * @param {Set<string>} [opts.omitIfZero]  Drop attribute if numeric value is 0.
 * @param {Set<string>} [opts.neverEmit]   Drop attribute regardless of value.
 */
function attrs(map, opts) {
  const omitIfZero = (opts && opts.omitIfZero) || null;
  const neverEmit = (opts && opts.neverEmit) || null;
  const parts = [];
  for (const k of Object.keys(map)) {
    if (neverEmit && neverEmit.has(k)) continue;
    const v = map[k];
    if (v === undefined || v === null) continue;
    if (omitIfZero && omitIfZero.has(k) && (v === 0 || v === '0')) continue;
    const out = typeof v === 'number' ? String(Math.round(v)) : xmlEsc(v);
    parts.push(` ${k}="${out}"`);
  }
  return parts.join('');
}

function buildCap11Element(row) {
  return `  <cap11${attrs(row, { omitIfZero: CAP11_OMIT_IF_ZERO, neverEmit: NEVER_EMIT_ATTRS })} />`;
}

function buildCap14Element(row) {
  return `  <cap14${attrs(row, { omitIfZero: CAP14_OMIT_IF_ZERO, neverEmit: NEVER_EMIT_ATTRS })} />`;
}

function buildObligRealizatElement(obligRealizat) {
  // The whole <oblig_realizat> element is a single self-closing tag with
  // ~50 attributes. The producer (lib/d212-oblig-realizat.js) decides which
  // attributes are present — we just emit what it gave us.
  return `  <oblig_realizat${attrs(obligRealizat)} />`;
}

/**
 * Build a D212 XML string.
 *
 * @param {object} input
 * @param {number} input.year                    Fiscal year (e.g. 2025).
 * @param {Array<object>} [input.cap11Rows=[]]   From lib/d212-cap11.js.
 * @param {Array<object>} [input.cap14Rows=[]]   From lib/d212-cap14.js.
 * @param {object} [input.obligRealizat]         From lib/d212-oblig-realizat.js.
 *                                               When provided, derives bifa132=1.
 * @param {object} [input.personalData]          Optional. { nume_c, prenume_c,
 *                                               cif, nerezident, cont_bancar }.
 *                                               When omitted, placeholders are
 *                                               emitted with a TODO comment.
 * @returns {string}
 */
function buildD212Xml(input) {
  const {
    year,
    cap11Rows = [],
    cap14Rows = [],
    obligRealizat = null,
    personalData = null,
  } = input || {};

  if (!year || !Number.isInteger(year)) {
    throw new Error('buildD212Xml: `year` (fiscal year integer) is required.');
  }

  const now = new Date();
  const an_r = year + 1;                              // submission year = fiscal year + 1
  // luna_r = "luna de raportare". For D212 (annual personal-income return)
  // ANAF always emits "12" — the fiscal year is reported as a whole, not
  // a specific month. Confirmed against a real DUF-generated XML.
  const luna_r = '12';

  const hasCap11 = cap11Rows.length > 0;
  const hasCap14 = cap14Rows.length > 0;
  const hasObligRealizat = !!(obligRealizat && Object.keys(obligRealizat).length > 0);
  // bifa132 (BT-00016) — "Date privind CASS datorată". Set when our
  // <oblig_realizat> declares a positive CASS contribution. The DUF portal
  // also flips this on whenever its CASS block is non-empty.
  const cassDue = hasObligRealizat && (obligRealizat.cass_anuala || 0) > 0;

  // Placeholder personal data — the user MUST replace these before import.
  const pd = personalData || {};
  const nume_c = pd.nume_c || 'NUME';
  const prenume_c = pd.prenume_c || 'PRENUME';
  const cif = pd.cif || '0000000000000';
  const nerezident = pd.nerezident != null ? String(pd.nerezident) : '0';
  const cont_bancar = pd.cont_bancar || null;

  // totalPlata_A = sum of CIF digits (BR-D212-0004). Computed when CIF is
  // a 13-digit numeric string; otherwise emit '0' and let the ANAF tool
  // recompute after the user fills the real CIF.
  let totalPlata_A;
  if (/^\d{13}$/.test(cif)) {
    let sum = 0;
    for (const ch of cif) sum += Number(ch);
    totalPlata_A = sum;
  } else {
    totalPlata_A = 0;
  }

  const rootAttrs = attrs({
    d_rec: 0,
    rectif1: 0,
    rectif2: 0,
    luna_r,
    an_r,
    anulare_litA: 0,
    anulare_litB: 0,
    bifa_conformare: 0,
    bifa111: hasCap11 ? 1 : 0,
    bifa112: 0,
    bifa113: 0,
    bifa121: hasCap14 ? 1 : 0,
    bifa122: 0,
    bifa131: 0,
    bifa132: cassDue ? 1 : 0,
    bifa14: 0,
    bifa15: 0,
    bifa18: 0,
    bifa19: 0,
    bifa23: 0,
    nume_c,
    prenume_c,
    cif,
    nerezident,
    cont_bancar,
    totalPlata_A,
  });

  const todoComment = personalData
    ? ''
    : `<!--\n  TODO INAINTE DE IMPORT ANAF:\n  Inlocuiti placeholder-urile cu datele personale reale:\n    nume_c="NUME"            -> numele de familie\n    prenume_c="PRENUME"      -> prenumele\n    cif="0000000000000"      -> CNP-ul (13 cifre)\n    nerezident="0"           -> 0 daca esti rezident RO, 1 altfel\n    cont_bancar=""           -> IBAN RO pentru restituire (optional)\n  totalPlata_A se va recalcula automat la import in tool-ul ANAF.\n-->\n`;

  // Version header — mirrors what the ANAF DUF portal writes when it
  // generates an XML. Gives the PDF tool a hint about which validation rule
  // set to apply when re-importing this file.
  const generatedAt = now.toISOString().replace('T', ' ').slice(0, 19);
  const versionHeader = `<!-- VERSIUNE_DECL=${SCHEMA_VERSION} -->\n<!-- DATA_GENERARE=${generatedAt} -->`;

  const cap11Xml = cap11Rows.map(buildCap11Element).join('\n');
  const cap14Xml = cap14Rows.map(buildCap14Element).join('\n');
  const obligRealizatXml = hasObligRealizat ? buildObligRealizatElement(obligRealizat) : '';

  // The XSI namespace declaration mirrors the ANAF DUF output. xsi:schemaLocation
  // points the validator at the target namespace; the actual XSD is shipped with
  // the ANAF PDF tool, so a relative URI is acceptable.
  const parts = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    versionHeader,
    todoComment,
    `<d212 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${NAMESPACE}" xmlns="${NAMESPACE}"${rootAttrs}>`,
  ];
  // Order matters: DUF emits oblig_realizat BEFORE cap11 / cap14.
  if (obligRealizatXml) parts.push(obligRealizatXml);
  if (cap11Xml) parts.push(cap11Xml);
  if (cap14Xml) parts.push(cap14Xml);
  parts.push(`</d212>`);
  return parts.filter(Boolean).join('\n');
}

module.exports = { buildD212Xml, xmlEsc };
