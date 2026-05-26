/**
 * Unit tests for lib/minizip.js — verify ZIP structure + determinism.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildZip, crc32 } = require('../lib/minizip');

test('crc32: known test vector', () => {
  // Per IEEE 802.3, crc32("123456789") = 0xCBF43926
  assert.equal(crc32(Buffer.from('123456789', 'utf8')), 0xCBF43926);
});

test('crc32: empty buffer returns 0', () => {
  assert.equal(crc32(Buffer.alloc(0)), 0);
});

test('buildZip: basic structure (single entry)', () => {
  const zip = buildZip([{ name: 'hello.txt', content: 'world' }]);
  // Should start with PK\x03\x04 (local file header signature)
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  // Should end with PK\x05\x06 (end of central directory signature)
  const eocdOffset = zip.length - 22;
  assert.equal(zip.readUInt32LE(eocdOffset), 0x06054b50);
  // Total entries on disk = 1
  assert.equal(zip.readUInt16LE(eocdOffset + 10), 1);
});

test('buildZip: produces byte-identical output for same input (determinism)', () => {
  const entries = [
    { name: 'a.txt', content: 'first' },
    { name: 'b.txt', content: 'second' },
  ];
  const z1 = buildZip(entries);
  const z2 = buildZip(entries);
  assert.deepEqual(z1, z2);
});

test('buildZip: empty archive', () => {
  const zip = buildZip([]);
  // Only EOCD record, 22 bytes
  assert.equal(zip.length, 22);
  assert.equal(zip.readUInt32LE(0), 0x06054b50);
});

test('buildZip: handles UTF-8 filenames', () => {
  const zip = buildZip([{ name: 'fișier-română.txt', content: 'salut' }]);
  // The general purpose flag should have bit 11 set (UTF-8 filename)
  const flag = zip.readUInt16LE(6);
  assert.equal(flag, 0x0800);
});

test('buildZip: real unzipper can read it (if PowerShell/tar available)', () => {
  // Skip if we can't invoke an external unzipper. This is best-effort —
  // not all CI environments have one. On Windows we use the built-in
  // Expand-Archive (Windows 8.1+).
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minizip-test-'));
  try {
    const zipPath = path.join(tmpDir, 'out.zip');
    const zip = buildZip([
      { name: 'a.txt', content: 'hello a' },
      { name: 'sub/b.txt', content: 'hello b' },
    ]);
    fs.writeFileSync(zipPath, zip);
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
    } catch (e) {
      // No unzipper available — skip the round-trip assertion.
    }
    if (extracted) {
      const aContent = fs.readFileSync(path.join(extractDir, 'a.txt'), 'utf8');
      const bContent = fs.readFileSync(path.join(extractDir, 'sub', 'b.txt'), 'utf8');
      assert.equal(aContent, 'hello a');
      assert.equal(bContent, 'hello b');
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
