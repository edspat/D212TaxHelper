/**
 * D212 personal-data validation and storage helpers.
 *
 * Personal data lives outside the year-data store because it's invariant
 * across fiscal years (a person's CNP doesn't change). It's persisted as
 * a single JSON document at `data/personal_data.json` (gitignored — see
 * .gitignore) so the operator stays in full control of where the PII lives.
 *
 * Why we validate here rather than relying on ANAF
 * -----------------------------------------------
 * The official D212 PDF tool validates CNP / IBAN at import time, but the
 * feedback is generic ("invalid format"). By running the same checks in the
 * app, we surface specific errors (wrong CNP checksum, IBAN modulo 97
 * mismatch) before the user wastes time round-tripping through the tool.
 *
 * Validation references
 * ---------------------
 * * BR-D212-0001 — CNP must be 13 digits with valid mod-11 checksum.
 *   Source: docs/anaf/d212-2025/codes/d212-codes.sch (rule CD-D212-CNP)
 *   and Cod fiscal art. 82 (definition of identification number).
 *   The checksum constant string is the textbook "279146358279" pattern.
 * * BR-D212-0012 — IBAN RO must be 24 chars, mod 97 = 1.
 *   Source: ISO 13616 / docs/anaf/d212-2025/business/d212-business.sch.
 */

'use strict';

/**
 * @typedef {object} PersonalData
 * @property {string} [nume_c]      Surname (BT-00023) — required by schema, free text
 * @property {string} [initiala_c]  Father's initial (BT-00024) — optional
 * @property {string} [prenume_c]   Given name (BT-00025)
 * @property {string} [cif]         CNP / CIF (BT-00030) — 13 digits
 * @property {string|number} [nerezident]  '0' resident, '1' non-resident
 * @property {string} [cont_bancar] IBAN (BT-00035) — optional but recommended
 */

const CNP_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

/**
 * Validate a Romanian CNP (Cod Numeric Personal) per BR-D212-0001.
 * Returns true iff exactly 13 digits AND the mod-11 checksum matches the
 * last digit. Empty / wrong-length inputs return false.
 */
function validateCNP(cnp) {
  if (typeof cnp !== 'string' && typeof cnp !== 'number') return false;
  const s = String(cnp).trim();
  if (!/^\d{13}$/.test(s)) return false;
  // First digit constraint: 1..8 (S codes; 9 reserved for non-residents)
  const first = Number(s[0]);
  if (first < 1 || first > 8) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * CNP_WEIGHTS[i];
  let check = sum % 11;
  if (check === 10) check = 1;
  return check === Number(s[12]);
}

/**
 * Validate an IBAN per ISO 13616 mod-97. Accepts only RO IBANs (24 chars,
 * "RO" prefix) since D212 BR-D212-0012 restricts cont_bancar to Romanian
 * bank accounts (the refund flows through SPV → BCR/BT/ING/etc.).
 * Spaces are tolerated and stripped before validation.
 */
function validateIBAN(iban) {
  if (typeof iban !== 'string') return false;
  const s = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^RO\d{2}[A-Z0-9]{20}$/.test(s)) return false;
  // Move first 4 chars to end, convert letters A-Z to 10-35, then mod 97.
  const rearranged = s.slice(4) + s.slice(0, 4);
  let numeric = '';
  for (const ch of rearranged) {
    if (ch >= '0' && ch <= '9') numeric += ch;
    else numeric += String(ch.charCodeAt(0) - 55); // 'A' = 10
  }
  // Iterative mod 97 — JS Number isn't large enough for 24+-digit integers.
  let remainder = 0;
  for (const d of numeric) {
    remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

/**
 * Run all checks on a personal-data record and produce a validation summary.
 * The XML emitter will block export when `valid` is false AND personalData
 * was explicitly provided; callers that pass `personalData=null` (use
 * placeholders) skip this entirely.
 *
 * @param {PersonalData} pd
 * @returns {{ valid: boolean, errors: Array<{field: string, message: string}> }}
 */
function validatePersonalData(pd) {
  const errors = [];
  if (!pd || typeof pd !== 'object') {
    return { valid: false, errors: [{ field: '_root', message: 'Personal data must be an object' }] };
  }
  // nume_c and prenume_c are required by the XSD (use="required") but the
  // schema only enforces non-empty. Trim and require at least 1 character.
  if (!pd.nume_c || !String(pd.nume_c).trim()) {
    errors.push({ field: 'nume_c', message: 'Numele este obligatoriu.' });
  }
  if (!pd.prenume_c || !String(pd.prenume_c).trim()) {
    errors.push({ field: 'prenume_c', message: 'Prenumele este obligatoriu.' });
  }
  if (!pd.cif) {
    errors.push({ field: 'cif', message: 'CNP-ul este obligatoriu.' });
  } else if (!validateCNP(pd.cif)) {
    errors.push({ field: 'cif', message: 'CNP-ul nu trece checksum-ul (BR-D212-0001). Verifică-l să aibă 13 cifre și să fie valid.' });
  }
  if (pd.cont_bancar && String(pd.cont_bancar).trim() !== '' && !validateIBAN(pd.cont_bancar)) {
    errors.push({ field: 'cont_bancar', message: 'IBAN-ul nu trece checksum-ul mod 97 (BR-D212-0012). Trebuie să fie un IBAN RO valid.' });
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Sanitize a record before persisting: trim whitespace, normalize case,
 * coerce nerezident to '0' or '1'. Returns a fresh object — never mutates
 * the input.
 */
function sanitizePersonalData(pd) {
  const out = {};
  if (!pd || typeof pd !== 'object') return out;
  if (pd.nume_c != null) out.nume_c = String(pd.nume_c).trim();
  if (pd.initiala_c != null) out.initiala_c = String(pd.initiala_c).trim();
  if (pd.prenume_c != null) out.prenume_c = String(pd.prenume_c).trim();
  if (pd.cif != null) out.cif = String(pd.cif).trim().replace(/\s+/g, '');
  if (pd.cont_bancar != null) out.cont_bancar = String(pd.cont_bancar).replace(/\s+/g, '').toUpperCase();
  if (pd.nerezident != null) out.nerezident = Number(pd.nerezident) === 1 ? '1' : '0';
  return out;
}

module.exports = {
  validateCNP,
  validateIBAN,
  validatePersonalData,
  sanitizePersonalData,
};
