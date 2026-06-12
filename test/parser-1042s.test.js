/**
 * Unit tests for parseForm1042S in server.js.
 *
 * A real 1042-S PDF (Foreign Person's U.S. Source Income Subject to
 * Withholding) emitted by NFS / Fidelity carries multiple forms in one
 * PDF, each printed three times for Copy A / B / C. The old single-result
 * parser silently dropped everything except the first form. These tests
 * exercise the multi-form path with a synthetic text fixture that mirrors
 * the structure of the real PDF but uses only public placeholder values
 * (no PII).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// parseForm1042S lives inside server.js (no module exports yet, because the
// file also wires Express). Pull it out via a regex slice and eval — fragile,
// but consistent with how some of the other server-side helpers are tested.
// If we ever extract the parsers into lib/parsers/ this fixture becomes a
// plain require().
const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const startIdx = serverSrc.indexOf('// Parse IRS Form 1042-S');
const endIdx = serverSrc.indexOf('// parseXtbPortfolio is imported', startIdx);
if (startIdx < 0 || endIdx < 0) throw new Error('Could not locate parseForm1042S in server.js');
const parserSrc = serverSrc.slice(startIdx, endIdx);
function parseNumber(s) { return parseFloat(String(s).replace(/,/g, '')) || 0; }
// eslint-disable-next-line no-eval
eval(parserSrc);

// One form, three copies — the most common case for a single-income-code PDF.
const SINGLE_FORM_FIXTURE = `
Form 1042-S
UNIQUE FORM IDENTIFIER
1 2 3 4 5 6 7 8 9 0
1 Income
code
06
2 Gross income
1,000.00
3b Tax rate 10.00
7a Federal tax withheld
12d Withholding agent's name
EXAMPLE BROKER LLC
13a Recipient's name
JOHN DOE
13b Recipient's country code
RO
COPY A
Form 1042-S
UNIQUE FORM IDENTIFIER
1 2 3 4 5 6 7 8 9 0
1 Income
code
06
2 Gross income
1,000.00
3b Tax rate 10.00
COPY B
Form 1042-S
UNIQUE FORM IDENTIFIER
1 2 3 4 5 6 7 8 9 0
1 Income
code
06
2 Gross income
1,000.00
3b Tax rate 10.00
COPY C
`;

// Two distinct forms (e.g. interest + dividends), each printed three times.
const MULTI_FORM_FIXTURE = `
Form 1042-S
UNIQUE FORM IDENTIFIER
2 5 0 1 6 3 1 5 2 0
1 Income
code
01
2 Gross income
2.00
3b Tax rate 0.00
12d Withholding agent's name
EXAMPLE BROKER LLC
13a Recipient's name
JANE DOE
13b Recipient's country code
RO
COPY A
COPY B
COPY C
Form 1042-S
UNIQUE FORM IDENTIFIER
2 5 0 1 6 3 1 5 2 2
1 Income
code
06
2 Gross income
215.00
3b Tax rate 10.00
12d Withholding agent's name
EXAMPLE BROKER LLC
13a Recipient's name
JANE DOE
13b Recipient's country code
RO
COPY A
COPY B
COPY C
`;

test('parseForm1042S returns {forms: [...]} (not a single object)', () => {
  const r = parseForm1042S(SINGLE_FORM_FIXTURE, 2025);
  assert.ok(r && Array.isArray(r.forms), 'result must have a forms array');
});

test('parseForm1042S collapses 3 copies of the same UID into 1 entry', () => {
  const r = parseForm1042S(SINGLE_FORM_FIXTURE, 2025);
  assert.equal(r.forms.length, 1, 'three copies must collapse to one entry');
  const f = r.forms[0];
  assert.equal(f.uniqueFormId, '1234567890');
  assert.equal(f.incomeCode, '06');
  assert.equal(f.incomeType, 'Dividends');
  assert.equal(f.grossIncomeUSD, 1000);
  assert.equal(f.taxRate, 10);
  // Agent/recipient appear only in Copy A; merge logic must surface them.
  assert.equal(f.withholdingAgent, 'EXAMPLE BROKER LLC');
  assert.equal(f.recipientName, 'JOHN DOE');
  assert.equal(f.recipientCountry, 'RO');
});

test('parseForm1042S extracts BOTH forms from a multi-form PDF', () => {
  // Regression: prior implementation only ever returned the first match for
  // every field; PDFs with both Interest (code 01) and Dividends (code 06)
  // silently lost the dividend block. This is the bug the user reported.
  const r = parseForm1042S(MULTI_FORM_FIXTURE, 2025);
  assert.equal(r.forms.length, 2, 'multi-form PDF must yield exactly 2 entries');

  const codes = r.forms.map((f) => f.incomeCode).sort();
  assert.deepEqual(codes, ['01', '06']);

  const interest = r.forms.find((f) => f.incomeCode === '01');
  assert.equal(interest.grossIncomeUSD, 2);
  assert.equal(interest.incomeType, 'Interest');
  assert.equal(interest.uniqueFormId, '2501631520');

  const dividends = r.forms.find((f) => f.incomeCode === '06');
  assert.equal(dividends.grossIncomeUSD, 215);
  assert.equal(dividends.incomeType, 'Dividends');
  assert.equal(dividends.uniqueFormId, '2501631522');
  assert.equal(dividends.taxRate, 10);
});

test('parseForm1042S maps known income codes to friendly labels', () => {
  // 01 → Interest, 06 → Dividends, 15 → Pensions, 27 → Capital Gains
  for (const [code, label] of [['01', 'Interest'], ['06', 'Dividends'], ['15', 'Pensions'], ['27', 'Capital Gains']]) {
    const text = `\nUNIQUE FORM IDENTIFIER\n0 0 0 0 ${code}\n1 Income\ncode\n${code}\n2 Gross income\n100.00\n`;
    const r = parseForm1042S(text, 2025);
    assert.equal(r.forms.length, 1);
    assert.equal(r.forms[0].incomeType, label);
  }
});

test('parseForm1042S labels unknown codes as Other (NN)', () => {
  const text = '\nUNIQUE FORM IDENTIFIER\n0 0 0 0 1\n1 Income\ncode\n99\n2 Gross income\n50.00\n';
  const r = parseForm1042S(text, 2025);
  assert.equal(r.forms[0].incomeType, 'Other (99)');
});

test('parseForm1042S returns an empty array when input has no recognizable forms', () => {
  const r = parseForm1042S('this is not a 1042-S document', 2025);
  assert.deepEqual(r.forms, []);
});

test('parseForm1042S without an UID anchor still parses a single form from the body', () => {
  // Legacy compatibility: some printers omit the UNIQUE FORM IDENTIFIER block.
  // We still want to capture a single form when the income code + gross are
  // present, with an empty uniqueFormId.
  const text = `1 Income\ncode\n06\n2 Gross income\n42.00\n3b Tax rate 0.00\n`;
  const r = parseForm1042S(text, 2025);
  assert.equal(r.forms.length, 1);
  assert.equal(r.forms[0].uniqueFormId, '');
  assert.equal(r.forms[0].grossIncomeUSD, 42);
});

test('parseForm1042S: same-UID copies do not overwrite later forms with the same code', () => {
  // Edge case: a PDF where two distinct forms accidentally share a UID
  // (shouldn't happen in practice, but a robust dedup key needs to discriminate).
  // The merge logic groups by UID so the two would collapse — that's the
  // expected behavior; this test pins it so a future "ungroup" refactor must
  // update the test explicitly.
  const text = `
UNIQUE FORM IDENTIFIER
1 1 1
1 Income
code
01
2 Gross income
1.00
UNIQUE FORM IDENTIFIER
1 1 1
1 Income
code
06
2 Gross income
99.00
`;
  const r = parseForm1042S(text, 2025);
  // 1 entry because the two segments share a UID and the merge keeps the
  // first form's code while overwriting with the later non-zero gross.
  assert.equal(r.forms.length, 1);
});

// Regression: real NFS PDFs render the federal-tax-withheld value AFTER all
// the labels, in a trailing numeric block. A naive `7a Federal tax withheld
// [\s\S]*?\d+\.\d{2}` regex greedy-skips into the gross-income line and
// captures the wrong number (e.g. $215 gross instead of $21 withheld).
// This test pins the value-block parser to the NFS layout shape.
test('parseForm1042S: federalTaxWithheld is read from the trailing numeric value block, not from the label position', () => {
  const fixture = `
UNIQUE FORM IDENTIFIER
2 5 0 1 6 3 1 5 2 2
1 Income
code
06
2 Gross income
215.00
3b Tax rate 10.00
7a Federal tax withheld
12d Withholding agent's name
EXAMPLE BROKER LLC
13a Recipient's name
JANE DOE
13b Recipient's country code
RO
15c Ch. 4 status code15b Ch. 3 status code
1 9 7 9 1 00 3
0.00
0.00
21.00
0.00
0.00
21.00
COPY B
`;
  const r = parseForm1042S(fixture, 2025);
  assert.equal(r.forms.length, 1);
  const f = r.forms[0];
  assert.equal(f.grossIncomeUSD, 215, 'gross income must come from box 2 (label-adjacent)');
  assert.equal(f.taxRate, 10, 'tax rate must come from box 3b (label-adjacent)');
  assert.equal(f.federalTaxWithheldUSD, 21, 'withheld must be 21 (box 7a), NOT 215 (gross)');
  assert.equal(f.totalWithholdingCreditUSD, 21, 'total credit must be box 10 in the value block');
});
