/**
 * Minimal ZIP archive writer (no compression, "STORE" mode).
 *
 * Why custom instead of `archiver` / `jszip`?
 * -------------------------------------------
 * D212TaxHelper is local-first and tries to minimize the runtime
 * dependency surface (skill rule: never add a new package.json runtime
 * dep without explicit approval). For audit-pack export the contents
 * are small (a few KB of text), so compression buys little and STORE
 * mode lets us produce **byte-identical** zips for the same inputs,
 * which lets users verify their archives with a checksum.
 *
 * Spec reference: PKWARE APPNOTE.TXT v6.3.10, sections 4.3.7 (local
 * header), 4.3.12 (central directory header), 4.3.16 (end of central
 * directory record). CRC-32 is computed per IEEE 802.3 (polynomial
 * 0xEDB88320 reflected).
 *
 * Limitations
 * -----------
 * - No compression. Each entry is stored as-is.
 * - No ZIP64. Max archive size ~4 GB, max entry size ~4 GB. Plenty for
 *   audit packs (KB range).
 * - No directory entries. Sub-paths like "raw/foo.txt" work as flat
 *   names; unzippers create the directory automatically.
 * - No encryption, no comments.
 *
 * Determinism
 * -----------
 * - All timestamps are fixed at 1980-01-01 00:00:00 (the ZIP epoch).
 * - File mode = 0 (no Unix attributes).
 * - Entries are emitted in the order given to `buildZip`; the caller
 *   is responsible for sorting if reproducibility is required.
 */

'use strict';

// Pre-computed CRC-32 table (IEEE 802.3 polynomial, reflected 0xEDB88320).
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** Compute CRC-32 of a Buffer. */
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Build a ZIP archive from a list of entries.
 *
 * @param {Array<{name: string, content: Buffer|string}>} entries
 * @returns {Buffer}
 */
function buildZip(entries) {
  // Per APPNOTE 4.4.6 dos time/date fields encode 1980-01-01 00:00:00 as
  //   time = 0x0000, date = 0x0021 (year=0 (offset from 1980), month=1, day=1).
  const DOS_TIME = 0x0000;
  const DOS_DATE = 0x0021;

  const chunks = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(String(entry.content), 'utf8');
    const crc = crc32(content);
    const size = content.length;

    // Local file header (PK\x03\x04, 30 bytes + filename + extra)
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);            // signature
    lfh.writeUInt16LE(20, 4);                    // version needed
    lfh.writeUInt16LE(0x0800, 6);                // general purpose flag (bit 11 = UTF-8 filename)
    lfh.writeUInt16LE(0, 8);                     // compression = STORE
    lfh.writeUInt16LE(DOS_TIME, 10);             // mod time
    lfh.writeUInt16LE(DOS_DATE, 12);             // mod date
    lfh.writeUInt32LE(crc, 14);                  // crc-32
    lfh.writeUInt32LE(size, 18);                 // compressed size = size (STORE)
    lfh.writeUInt32LE(size, 22);                 // uncompressed size
    lfh.writeUInt16LE(nameBytes.length, 26);     // filename length
    lfh.writeUInt16LE(0, 28);                    // extra field length
    chunks.push(lfh, nameBytes, content);

    // Central directory header (PK\x01\x02, 46 bytes + filename + extra + comment)
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);            // signature
    cdh.writeUInt16LE(20, 4);                    // version made by
    cdh.writeUInt16LE(20, 6);                    // version needed
    cdh.writeUInt16LE(0x0800, 8);                // general purpose flag (UTF-8)
    cdh.writeUInt16LE(0, 10);                    // compression
    cdh.writeUInt16LE(DOS_TIME, 12);
    cdh.writeUInt16LE(DOS_DATE, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(size, 20);
    cdh.writeUInt32LE(size, 24);
    cdh.writeUInt16LE(nameBytes.length, 28);     // filename length
    cdh.writeUInt16LE(0, 30);                    // extra field length
    cdh.writeUInt16LE(0, 32);                    // comment length
    cdh.writeUInt16LE(0, 34);                    // disk number
    cdh.writeUInt16LE(0, 36);                    // internal attrs
    cdh.writeUInt32LE(0, 38);                    // external attrs
    cdh.writeUInt32LE(offset, 42);               // local header offset
    central.push(cdh, nameBytes);

    offset += lfh.length + nameBytes.length + content.length;
  }

  const cdStart = offset;
  const cdBuf = Buffer.concat(central);
  chunks.push(cdBuf);

  // End of central directory record (22 bytes, no comment)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);                      // this disk
  eocd.writeUInt16LE(0, 6);                      // disk of cd start
  eocd.writeUInt16LE(entries.length, 8);         // entries on this disk
  eocd.writeUInt16LE(entries.length, 10);        // total entries
  eocd.writeUInt32LE(cdBuf.length, 12);          // cd size
  eocd.writeUInt32LE(cdStart, 16);               // cd offset
  eocd.writeUInt16LE(0, 20);                     // comment length
  chunks.push(eocd);

  return Buffer.concat(chunks);
}

module.exports = { buildZip, crc32 };
