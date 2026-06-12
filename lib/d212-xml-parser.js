/**
 * D212 XML parser — reads a DUF-generated XML (or any conforming D212 file)
 * and extracts the structured payload as JS objects.
 *
 * The DUF portal lets the user download a pre-filled XML containing what
 * ANAF already knows. Our app uses this parser to surface that data side-
 * by-side with what we computed locally, so the user can validate amounts
 * before typing them back into the DUF web form.
 *
 * Design notes
 * ------------
 * * Implemented with regex-based extraction rather than a full XML parser
 *   to keep the dependency tree at zero (per project policy on `node:test`,
 *   no new deps). D212 is a single-namespace, self-closing-element document,
 *   so a robust regex pass is sufficient. If ANAF ever introduces nested
 *   elements with mixed content this will need a real parser.
 * * PII handling: this module never logs or persists the parsed data. The
 *   caller (server endpoint + UI) decides whether to surface attributes
 *   like nume_c / cif. Tests use the anonymized fixture in
 *   test/fixtures/d212-sample-anaf.xml; real user XML stays in memory.
 */

'use strict';

/**
 * Pull all attribute name="value" pairs from a single XML element tag.
 * `attrString` is the substring after the element name and before "/>".
 * Returns a plain object — numeric strings are NOT converted, the caller
 * decides whether a value is a number, an enum code or a label.
 *
 * Handles the standard XML entities &amp; &lt; &gt; &quot; &apos;.
 */
function parseAttrs(attrString) {
  const out = {};
  if (!attrString) return out;
  const re = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(attrString)) !== null) {
    const key = m[1];
    if (key.startsWith('xmlns') || key === 'xsi:schemaLocation') continue;
    out[key] = m[2]
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  }
  return out;
}

/**
 * Extract every occurrence of `<elementName ... />` (self-closing) and
 * `<elementName ... >...</elementName>` (with content) from the document.
 * Returns an array of attribute maps (content is ignored — D212 carries
 * data on attributes only).
 */
function extractElements(xml, elementName) {
  const out = [];
  // Self-closing form
  const reSelf = new RegExp(`<${elementName}\\b([^>]*?)/>`, 'g');
  let m;
  while ((m = reSelf.exec(xml)) !== null) {
    out.push(parseAttrs(m[1]));
  }
  // Open-close form (rare for D212 but allow it)
  const reOpen = new RegExp(`<${elementName}\\b([^>]*)>[\\s\\S]*?</${elementName}>`, 'g');
  while ((m = reOpen.exec(xml)) !== null) {
    // Skip the ones we already captured as self-closing — they have "/>"
    // at the end of the open tag.
    if (m[1].trimEnd().endsWith('/')) continue;
    out.push(parseAttrs(m[1]));
  }
  return out;
}

/**
 * Extract attributes from the root `<d212 ...>` element. The tag may be
 * open or self-closing; either way we grab just the attribute string.
 */
function extractRootAttrs(xml) {
  const m = xml.match(/<d212\b([^>]*?)>/);
  if (!m) return {};
  // Strip a trailing "/" if the root happened to be self-closing
  let attrs = m[1];
  if (attrs.trimEnd().endsWith('/')) attrs = attrs.trimEnd().slice(0, -1);
  return parseAttrs(attrs);
}

// Attribute names that are identifiers / labels, not numeric quantities,
// even when they happen to look like all digits. Keeping them as strings
// preserves leading zeros (e.g. CAEN "0001"), 13-digit CNPs, and IBANs.
const STRING_ATTRS = new Set([
  'cif', 'cif_i', 'cif_str', 'cnpCoasigurat',
  'cont_bancar',
  'telefon_c', 'telefon_i', 'fax_c', 'fax_i', 'email_c',
  'caen', 'nr_doc_autoriz', 'nr_doc_asociere',
  'categ_venit', 'str_categ_venit',
  'nume_c', 'initiala_c', 'prenume_c',
  'descriere_sediu_bun',
  'data_doc_autoriz', 'str_data_incep', 'str_data_sf',
  'bifa_cass_real',
  'stat_rezidenta', 'str_stat_realiz_v', 'den_stat_rezidenta',
  'dubla_impunere',
]);

/**
 * Coerce a numeric-looking string into a JS number. Returns the string
 * unchanged when it's not a plain integer or decimal, or when the attribute
 * name is in STRING_ATTRS (identifier-shaped). Empty / null / undefined
 * become null.
 */
function maybeNumber(s, attrName) {
  if (s == null || s === '') return null;
  if (attrName && STRING_ATTRS.has(attrName)) return s;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  return s;
}

function normalizeRecord(rec) {
  const out = {};
  for (const k of Object.keys(rec)) {
    out[k] = maybeNumber(rec[k], k);
  }
  return out;
}

/**
 * Parse a D212 XML document.
 *
 * @param {string} xml  The raw XML string (entire file contents).
 * @returns {{
 *   root: object,             Root <d212> attributes (cif, nume_c, prenume_c, bifa*, an_r, luna_r, totalPlata_A, statut...)
 *   obligRealizat: object|null,
 *   cap11: Array<object>,     Cap. I § 1.1 — Romanian-source income rows
 *   cap14: Array<object>,     Cap. I § 2.1 — Foreign-source income rows
 *   raw: { byteLength: number, version?: string, generatedAt?: string }
 * }}
 */
function parseD212Xml(xml) {
  if (typeof xml !== 'string' || xml.length === 0) {
    throw new Error('parseD212Xml: empty input');
  }
  if (!/<d212\b/.test(xml)) {
    throw new Error('parseD212Xml: <d212> root element not found — is this a D212 XML?');
  }

  const root = normalizeRecord(extractRootAttrs(xml));
  const obligList = extractElements(xml, 'oblig_realizat').map(normalizeRecord);
  const cap11 = extractElements(xml, 'cap11').map(normalizeRecord);
  const cap14 = extractElements(xml, 'cap14').map(normalizeRecord);

  // The version + generation timestamp live in HTML-style comments that
  // both DUF and our own builder emit. Best-effort extraction.
  const verM = xml.match(/<!--\s*VERSIUNE_DECL=([^>]*?)\s*-->/);
  const genM = xml.match(/<!--\s*DATA_GENERARE=([^>]*?)\s*-->/);

  return {
    root,
    obligRealizat: obligList[0] || null,
    cap11,
    cap14,
    raw: {
      byteLength: xml.length,
      version: verM ? verM[1].trim() : undefined,
      generatedAt: genM ? genM[1].trim() : undefined,
    },
  };
}

module.exports = { parseD212Xml, parseAttrs, extractElements };
