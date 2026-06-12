/**
 * Unit tests for lib/audit-pack-builder.js — verify pack contents + determinism.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildAuditPack, stableSort } = require('../lib/audit-pack-builder');

const SAMPLE_YD = {
  xtbDividendsReport: {
    year: 2025,
    dividends: { grossRON: 1417, taxWithheldRON: 142, netRON: 1275 },
    dividendsByCountry: [
      { country: 'US', isRomanian: false, grossRON: 1000, taxRON: 100, netRON: 900 },
      { country: 'DE', isRomanian: false, grossRON: 417, taxRON: 42, netRON: 375 },
    ],
  },
  btPortfolio: {
    longTerm: { gainRON: 0, lossRON: 0, taxWithheldRON: 0 },
    shortTerm: { gainRON: 84151, lossRON: 0, taxWithheldRON: 2526 },
    totalGainRON: 84151,
    totalTaxWithheldRON: 2526,
    countries: [],
  },
};

test('buildAuditPack: produces a valid ZIP buffer', () => {
  const buf = buildAuditPack({ year: 2025, yearData: SAMPLE_YD });
  assert.ok(Buffer.isBuffer(buf));
  // PK\x03\x04 magic header
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
  // ZIP must include the EOCD signature
  assert.ok(buf.indexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) > 0);
});

test('buildAuditPack: contains the required files', () => {
  const buf = buildAuditPack({ year: 2025, yearData: SAMPLE_YD });
  const required = [
    'README.md',
    'methodology.md',
    'year-data.json',
    'exchange-rates.json',
    'calculation-trace.txt',
    'MANIFEST.json',
    'parsed-data/xtb-dividends.json',
    'parsed-data/bt-portfolio.json',
  ];
  for (const f of required) {
    assert.ok(buf.includes(f), `Missing file in archive: ${f}`);
  }
});

test('buildAuditPack: deterministic — same inputs produce identical bytes', () => {
  const a = buildAuditPack({ year: 2025, yearData: SAMPLE_YD });
  const b = buildAuditPack({ year: 2025, yearData: SAMPLE_YD });
  assert.deepEqual(a, b);
});

test('buildAuditPack: throws on missing year or yearData', () => {
  assert.throws(() => buildAuditPack({}), /year and yearData/);
  assert.throws(() => buildAuditPack({ year: 2025 }), /year and yearData/);
});

test('buildAuditPack: includes computed-values.json when computed provided', () => {
  const computed = { totalTax: 12345, cassTax: 1980, refundOwedRON: 0, cap11Rows: [], cap14Rows: [] };
  const buf = buildAuditPack({ year: 2025, yearData: SAMPLE_YD, computed });
  assert.ok(buf.includes('computed-values.json'));
});

test('buildAuditPack: skips parsed-data entries for absent sources', () => {
  // Only xtbDividendsReport is present — should NOT emit a fidelity-trades.json.
  const buf = buildAuditPack({ year: 2025, yearData: { xtbDividendsReport: SAMPLE_YD.xtbDividendsReport } });
  assert.ok(buf.includes('parsed-data/xtb-dividends.json'));
  // The string 'fidelity-trades.json' should not appear (since key absent).
  // Use a stricter check: we look for the central directory name field.
  // For STORE mode the filename appears verbatim in both local header
  // and central directory; if neither contains it, the entry is absent.
  assert.ok(!buf.includes('fidelity-trades.json'));
});

test('stableSort: sorts object keys deterministically', () => {
  const a = stableSort({ b: 1, a: 2, c: { z: 3, y: 4 } });
  assert.equal(JSON.stringify(a), JSON.stringify({ a: 2, b: 1, c: { y: 4, z: 3 } }));
});

test('stableSort: preserves array order, sorts nested object keys', () => {
  const a = stableSort([{ b: 2, a: 1 }, { z: 9, y: 8 }]);
  assert.equal(JSON.stringify(a), JSON.stringify([{ a: 1, b: 2 }, { y: 8, z: 9 }]));
});

test('buildAuditPack: includes generated D212 XML when provided', () => {
  const xml = '<?xml version="1.0"?><declaratie212><cap11/></declaratie212>';
  const buf = buildAuditPack({ year: 2025, yearData: SAMPLE_YD, generatedXml: xml });
  assert.ok(buf.includes('generated-d212-2025.xml'));
});

test('buildAuditPack: end-to-end via external unzipper (skip if unavailable)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-pack-test-'));
  try {
    const zipPath = path.join(tmpDir, 'pack.zip');
    const buf = buildAuditPack({
      year: 2025,
      yearData: SAMPLE_YD,
      computed: { totalTax: 1000, cap11Rows: [], cap14Rows: [] },
    });
    fs.writeFileSync(zipPath, buf);
    const extractDir = path.join(tmpDir, 'extracted');
    fs.mkdirSync(extractDir);
    let extracted = false;
    try {
      if (process.platform === 'win32') {
        execSync(`powershell -NoProfile -NonInteractive -Command "$ProgressPreference='SilentlyContinue'; Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`, { stdio: 'pipe' });
      } else {
        execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });
      }
      extracted = true;
    } catch (e) { /* no unzipper, skip */ }
    if (extracted) {
      const readme = fs.readFileSync(path.join(extractDir, 'README.md'), 'utf8');
      assert.match(readme, /D212 Audit Pack/);
      assert.match(readme, /2025/);
      const manifest = JSON.parse(fs.readFileSync(path.join(extractDir, 'MANIFEST.json'), 'utf8'));
      assert.equal(manifest.year, 2025);
      assert.ok(manifest.entries.length > 5);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
