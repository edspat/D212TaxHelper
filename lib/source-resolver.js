/**
 * Source resolver primitives for the D212 calc engine.
 *
 * The calculator pulls values from multiple sources for each field:
 *   - Tier 1 OVERRIDE  : explicit user override (yd.fidelityDividends, etc.)
 *   - Tier 2 ANAF_DOC  : official ANAF D212 PDF/XML import (yd.declaratie.anafXml)
 *   - Tier 3 DOCUMENT  : parsed broker documents (Fidelity, 1042-S, XTB, etc.)
 *   - Tier 4 MANUAL    : manual entries in the Add Data form (decl/inv/adv)
 *   - Tier 5 DERIVED   : computed from another tier'd value (X * BNR rate)
 *
 * The user-stated principle (May 2026) is:
 *   "Imported documents should be the primary source of truth. Manual entries
 *    are optional overrides on top. If I have no document, manual entry still
 *    works."
 *
 * Implementing this safely requires two things the naive `||` chain does NOT
 * give us:
 *   1. PRESENCE: a `0` from a parsed Fidelity statement that legitimately has
 *      zero dividends must not be confused with "no Fidelity statement found".
 *      Manual entries follow the same rule: empty string / undefined / null
 *      mean absent; 0 means "yes, zero, please use it".
 *   2. STABLE TIERS: priority must be the same shape across every field.
 *      A `pickFirst` helper makes the resolution audit-friendly and surfaces
 *      a sourceMap that the UI can render as 📄/✋/🛠️ badges.
 *
 * Aggregate fields (RO long-term gain = XTB + Tradeville, interest income =
 * bank + RO broker, ...) use `sumPresent` which sums every present source and
 * records each as a contributing source. Derived fields (dividendsRON =
 * dividendsUSD × rate) use `deriveValue` to keep the dependency chain visible.
 */

'use strict';

// Wrap the entire module body in an IIFE so that the `const TIER`,
// `function source`, etc. declarations stay local. Without this, when the
// file is loaded in the browser via `<script src="/lib/source-resolver.js">`
// alongside `<script src="/lib/income-resolvers.js">` (which destructures
// `const { TIER, ... } = _SR` at top level), both scripts run in the SAME
// global scope and the second `const TIER` declaration throws
// "Identifier 'TIER' has already been declared". Node `require()` is
// already isolated, so this IIFE is browser-only insurance.
(function () {

const TIER = Object.freeze({
  OVERRIDE: 'override',  // explicit user override - always wins
  ANAF_DOC: 'anaf-doc',  // official ANAF D212 import
  DOCUMENT: 'document',  // parsed broker document
  MANUAL: 'manual',      // manual default entry on Add Data form
  DERIVED: 'derived',    // computed from another resolved value
});

const TIER_RANK = Object.freeze({
  [TIER.OVERRIDE]: 1,
  [TIER.ANAF_DOC]: 2,
  [TIER.DOCUMENT]: 3,
  [TIER.MANUAL]: 4,
  [TIER.DERIVED]: 5,
});

/**
 * Decide whether a value should count as "present".
 *
 * - undefined, null, empty string → ABSENT
 * - NaN → ABSENT
 * - 0 → PRESENT (zero is a valid answer)
 * - any other number/non-empty string → PRESENT
 *
 * @param {*} v
 * @returns {boolean}
 */
function isPresent(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  if (typeof v === 'number' && Number.isNaN(v)) return false;
  return true;
}

/**
 * Coerce a present source to a number; ABSENT and invalid stay as `null`.
 *
 * @param {*} v
 * @returns {number|null}
 */
function asNumber(v) {
  if (!isPresent(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Build a source descriptor. Use this to keep ABSENT vs PRESENT explicit even
 * when the value happens to be 0.
 *
 * @param {*} rawValue      Raw value (number, numeric string, or absent marker)
 * @param {string} tier     One of TIER.*
 * @param {string} label    Human-readable label for the UI ("Fidelity statement", "Add Data form", ...)
 * @param {object} [opts]
 * @param {boolean} [opts.present]
 *        Force presence regardless of value heuristics. Useful when a parsed
 *        document is known to exist but reported 0 for a sub-field — e.g.
 *        `yd.form1042s.length > 0` proves a 1042-S was uploaded even if no
 *        dividend form (code 06) was included, so the aggregate `f1042sDivUSD`
 *        should be PRESENT with value 0 rather than ABSENT.
 * @returns {{value: number|null, present: boolean, tier: string, label: string}}
 */
function source(rawValue, tier, label, opts = {}) {
  if (!TIER_RANK[tier]) {
    throw new Error(`source(): unknown tier "${tier}"`);
  }
  const num = asNumber(rawValue);
  const present = opts.present === true ? true : (opts.present === false ? false : isPresent(rawValue));
  return {
    value: present ? (num != null ? num : 0) : null,
    present,
    tier,
    label,
  };
}

/**
 * Pick the highest-priority present source for a mutually-exclusive field.
 *
 * Sources may be supplied in any order; this helper sorts by TIER_RANK.
 *
 * @param {Array} sources    Array of `source()` results
 * @returns {{value: number, present: boolean, tier: string|null, label: string|null, alternates: Array}}
 *   - value     : the chosen number (0 if no source is present)
 *   - present   : whether ANY source was present
 *   - tier/label: of the chosen source (null if none present)
 *   - alternates: every OTHER present source (for conflict detection / UI tooltip)
 */
function pickFirst(sources) {
  const present = (sources || []).filter((s) => s && s.present);
  if (present.length === 0) {
    return { value: 0, present: false, tier: null, label: null, alternates: [] };
  }
  present.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
  const [chosen, ...rest] = present;
  return {
    value: chosen.value,
    present: true,
    tier: chosen.tier,
    label: chosen.label,
    alternates: rest,
  };
}

/**
 * Sum every present source. Use this for aggregate fields where multiple
 * sources legitimately contribute (e.g. RO long-term gain = XTB + Tradeville).
 *
 * @param {Array} sources
 * @returns {{value: number, present: boolean, contributors: Array, tier: string|null, label: string|null}}
 *   - value        : sum of all present sources (0 if none)
 *   - present      : true if ANY source contributed
 *   - contributors : array of the contributing sources (for the UI to list)
 *   - tier         : "document" if any contributor was a document, else the strongest tier present
 *   - label        : composite label "X + Y + Z" when there are multiple
 */
function sumPresent(sources) {
  const present = (sources || []).filter((s) => s && s.present);
  if (present.length === 0) {
    return { value: 0, present: false, contributors: [], tier: null, label: null };
  }
  const value = present.reduce((s, c) => s + (c.value || 0), 0);
  // Strongest = lowest rank (1 wins). Composite label sums non-zero contributors.
  const strongest = present.reduce((a, b) => (TIER_RANK[a.tier] <= TIER_RANK[b.tier] ? a : b));
  const nonZero = present.filter((c) => c.value !== 0);
  const label = nonZero.length === 0
    ? strongest.label
    : nonZero.length === 1
      ? nonZero[0].label
      : nonZero.map((c) => c.label).join(' + ');
  return {
    value,
    present: true,
    contributors: present,
    tier: strongest.tier,
    label,
  };
}

/**
 * Mark a value as derived from one or more upstream resolutions, recording
 * the formula label for the UI.
 *
 * @param {number} value           The computed value
 * @param {Array<object>} upstream Array of prior resolutions this depends on
 * @param {string} formula         Short human label, e.g. "USD × BNR USD/RON"
 * @returns {{value: number, present: boolean, tier: 'derived', label: string, derivedFrom: Array}}
 */
function deriveValue(value, upstream, formula) {
  return {
    value: Number.isFinite(value) ? value : 0,
    present: true,
    tier: TIER.DERIVED,
    label: formula,
    derivedFrom: upstream || [],
  };
}

/**
 * Detect conflicts between sources: same field, different tiers, materially
 * different values. Useful for the one-time "Imported documents replace your
 * manual values" banner.
 *
 * @param {{value: number, alternates: Array}} resolution  Result from pickFirst
 * @param {object} [opts]
 * @param {number} [opts.absEps=1]   Absolute tolerance (RON or units of the value)
 * @param {number} [opts.relEps=0.01] Relative tolerance (1% by default)
 * @returns {Array<{chosen: object, alternative: object, delta: number}>}
 */
function detectConflicts(resolution, opts = {}) {
  if (!resolution || !resolution.present || !resolution.alternates) return [];
  const absEps = opts.absEps != null ? opts.absEps : 1;
  const relEps = opts.relEps != null ? opts.relEps : 0.01;
  const chosen = { value: resolution.value, tier: resolution.tier, label: resolution.label };
  const out = [];
  for (const alt of resolution.alternates) {
    const delta = Math.abs((alt.value || 0) - (resolution.value || 0));
    const denom = Math.max(Math.abs(resolution.value || 0), Math.abs(alt.value || 0), 1);
    const rel = delta / denom;
    if (delta > absEps && rel > relEps) {
      out.push({ chosen, alternative: { value: alt.value, tier: alt.tier, label: alt.label }, delta });
    }
  }
  return out;
}

const _exports = {
  TIER,
  TIER_RANK,
  isPresent,
  asNumber,
  source,
  pickFirst,
  sumPresent,
  deriveValue,
  detectConflicts,
};

// Dual export: CommonJS (Node) for the server + tests, window global for the
// browser when loaded as a <script src="/lib/source-resolver.js"></script>.
// Using a guarded assignment so the browser doesn't throw on the undefined
// `module` binding.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = _exports;
}
if (typeof window !== 'undefined') {
  window.SourceResolver = _exports;
}

})();
