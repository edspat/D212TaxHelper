/**
 * Unit tests for lib/d212-xml-builder.js — D212 XML emission.
 *
 * The golden assertions are deliberately structural (presence of attributes,
 * correct values) rather than byte-equal — the builder reserves the right
 * to reformat whitespace between releases.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildD212Xml, xmlEsc } = require('../lib/d212-xml-builder');

test('throws when year is missing or not integer', () => {
  assert.throws(() => buildD212Xml({}), /year/);
  assert.throws(() => buildD212Xml({ year: '2025' }), /year/);
  assert.throws(() => buildD212Xml({ year: 2025.5 }), /year/);
});

test('empty payload → minimal valid skeleton with both bifa flags = 0', () => {
  const xml = buildD212Xml({ year: 2025 });
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<d212\b[^>]*\sxmlns="mfp:anaf:dgti:d212:declaratie:v11"/);
  assert.match(xml, /\san_r="2026"/);                       // year + 1
  assert.match(xml, /\sbifa111="0"/);
  assert.match(xml, /\sbifa121="0"/);
  assert.match(xml, /\sd_rec="0"/);
  assert.match(xml, /<\/d212>/);
  assert.doesNotMatch(xml, /<cap11/);
  assert.doesNotMatch(xml, /<cap14/);
});

test('with cap11Rows → bifa111=1 and cap11 element emitted with all attrs', () => {
  const cap11Rows = [{
    categ_venit: '1012',
    den_venit: 'Câștiguri din transferul titlurilor de valoare',
    venit_brut: 15000,
    chelt_deduc: 0,
    venit_net_anual: 15000,
    pierdere: 0,
    pierdere_precedenta: 0,
    pierdere_compensata: 0,
    venit_recalculat: 15000,
    impozit11: 250,
    impozit_retinut: 250,
  }];
  const xml = buildD212Xml({ year: 2025, cap11Rows });
  assert.match(xml, /\sbifa111="1"/);
  assert.match(xml, /<cap11[^/]+categ_venit="1012"/);
  assert.match(xml, /\svenit_brut="15000"/);
  assert.match(xml, /\simpozit11="250"/);
  assert.match(xml, /\simpozit_retinut="250"/);
});

test('with cap14Rows → bifa121=1 and multi-row emission', () => {
  const cap14Rows = [
    {
      str_stat_realiz_v: 'US', den_stat: 'SUA', str_categ_venit: '2018', den_categ_venit: 'Dividende',
      dubla_impunere: '1', str_venit_brut: 4500, str_chelt_deduc: 0, str_venit_net_anual: 4500,
      str_pierdere_anuala: 0, str_pierdere_precedenta: 0, str_pierdere_compensata: 0,
      str_venit_recalculat: 4500, str_impozit_datorat_Ro: 450, str_impozit_platit: 675,
      str_credit_fiscal: 450, str_dif_impozit_datorat: 0,
    },
    {
      str_stat_realiz_v: 'US', den_stat: 'SUA', str_categ_venit: '2012', den_categ_venit: 'Capgains',
      dubla_impunere: '1', str_venit_brut: 45000, str_chelt_deduc: 29000, str_venit_net_anual: 16000,
      str_pierdere_anuala: 0, str_pierdere_precedenta: 0, str_pierdere_compensata: 0,
      str_venit_recalculat: 16000, str_impozit_datorat_Ro: 1600, str_impozit_platit: 0,
      str_credit_fiscal: 0, str_dif_impozit_datorat: 1600,
    },
  ];
  const xml = buildD212Xml({ year: 2025, cap14Rows });
  assert.match(xml, /\sbifa121="1"/);
  // Both rows present
  assert.match(xml, /<cap14[^/]+str_categ_venit="2018"/);
  assert.match(xml, /<cap14[^/]+str_categ_venit="2012"/);
  // Counts: exactly 2 cap14 self-closing tags
  const cap14Count = (xml.match(/<cap14 /g) || []).length;
  assert.equal(cap14Count, 2);
});

test('placeholder personal data + TODO comment when personalData omitted', () => {
  const xml = buildD212Xml({ year: 2025 });
  assert.match(xml, /\snume_c="NUME"/);
  assert.match(xml, /\sprenume_c="PRENUME"/);
  assert.match(xml, /\scif="0000000000000"/);
  assert.match(xml, /TODO INAINTE DE IMPORT/);
});

test('personalData → no TODO comment + values used + totalPlata_A computed', () => {
  // CNP "1900101220033" has digits sum 1+9+0+0+1+0+1+2+2+0+0+3+3 = 22
  const xml = buildD212Xml({
    year: 2025,
    personalData: {
      nume_c: 'Popescu', prenume_c: 'Ion', cif: '1900101220033', nerezident: 0,
      cont_bancar: 'RO49AAAA1B31007593840000',
    },
  });
  assert.doesNotMatch(xml, /TODO INAINTE DE IMPORT/);
  assert.match(xml, /\snume_c="Popescu"/);
  assert.match(xml, /\sprenume_c="Ion"/);
  assert.match(xml, /\scif="1900101220033"/);
  assert.match(xml, /\stotalPlata_A="22"/);
  assert.match(xml, /\scont_bancar="RO49AAAA1B31007593840000"/);
});

test('xmlEsc handles entity-relevant characters', () => {
  assert.equal(xmlEsc('A&B'), 'A&amp;B');
  assert.equal(xmlEsc('<tag>'), '&lt;tag&gt;');
  assert.equal(xmlEsc('"q"'), '&quot;q&quot;');
  assert.equal(xmlEsc(null), '');
  assert.equal(xmlEsc(undefined), '');
});

test('special chars in emitted attributes are properly escaped', () => {
  // den_stat / den_categ_venit are now intentionally never emitted (matches
  // the ANAF DUF output style — codes alone are sufficient). Use the
  // personal-data fields, which ARE emitted, to exercise the escaping path.
  const xml = buildD212Xml({
    year: 2025,
    personalData: {
      nume_c: 'A & B "Co"', prenume_c: 'X<Y>', cif: '1800101220038', nerezident: 0,
    },
  });
  assert.match(xml, /nume_c="A &amp; B &quot;Co&quot;"/);
  assert.match(xml, /prenume_c="X&lt;Y&gt;"/);
  assert.doesNotMatch(xml, /A & B "Co"/);
});

test('luna_r is always 12 (annual reporting, matches ANAF DUF output)', () => {
  // D212 is an annual personal-income return; luna_r encodes the reporting
  // month as 12 (December = end of fiscal year), not the month of generation.
  // Regression: an earlier version emitted the current month, which made the
  // ANAF tool reject the file when it was generated mid-year.
  const xml = buildD212Xml({ year: 2025 });
  assert.match(xml, /\sluna_r="12"/);
});

test('emits xsi:schemaLocation declaration matching DUF output', () => {
  const xml = buildD212Xml({ year: 2025 });
  assert.match(xml, /xmlns:xsi="http:\/\/www\.w3\.org\/2001\/XMLSchema-instance"/);
  assert.match(xml, /xsi:schemaLocation="mfp:anaf:dgti:d212:declaratie:v11"/);
});

test('emits VERSIUNE_DECL and DATA_GENERARE comments', () => {
  const xml = buildD212Xml({ year: 2025 });
  assert.match(xml, /<!-- VERSIUNE_DECL=V-[\d.]+\s*\/\s*[\d.]+ -->/);
  assert.match(xml, /<!-- DATA_GENERARE=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} -->/);
});

test('cap14 row: zero-valued inputs are omitted, calculated outputs kept', () => {
  // Matches the ANAF DUF emission style: input fields drop when zero, output
  // fields stay so the PDF tool sees the computed result explicitly.
  const cap14Rows = [{
    str_stat_realiz_v: 'US', den_stat: 'SUA', str_categ_venit: '2012',
    den_categ_venit: 'Capital gains', dubla_impunere: '1',
    str_venit_brut: 0, str_chelt_deduc: 0, str_venit_net_anual: 0,
    str_pierdere_anuala: 0, str_pierdere_precedenta: 0, str_pierdere_compensata: 0,
    str_venit_recalculat: 0, str_impozit_datorat_Ro: 0, str_impozit_platit: 0,
    str_credit_fiscal: 0, str_dif_impozit_datorat: 0,
  }];
  const xml = buildD212Xml({ year: 2025, cap14Rows });
  // Input fields omitted when zero
  assert.doesNotMatch(xml, /\sstr_venit_brut=/);
  assert.doesNotMatch(xml, /\sstr_chelt_deduc=/);
  assert.doesNotMatch(xml, /\sstr_pierdere_anuala=/);
  assert.doesNotMatch(xml, /\sstr_pierdere_precedenta=/);
  assert.doesNotMatch(xml, /\sstr_impozit_datorat_Ro=/);
  assert.doesNotMatch(xml, /\sstr_impozit_platit=/);
  // Decorative attributes never emitted
  assert.doesNotMatch(xml, /\sden_stat=/);
  assert.doesNotMatch(xml, /\sden_categ_venit=/);
  // Calculated outputs kept (even at zero)
  assert.match(xml, /\sstr_venit_net_anual="0"/);
  assert.match(xml, /\sstr_pierdere_compensata="0"/);
  assert.match(xml, /\sstr_venit_recalculat="0"/);
  assert.match(xml, /\sstr_credit_fiscal="0"/);
  assert.match(xml, /\sstr_dif_impozit_datorat="0"/);
});

test('cap14 row: non-zero inputs ARE emitted', () => {
  const cap14Rows = [{
    str_stat_realiz_v: 'US', str_categ_venit: '2018', dubla_impunere: '1',
    str_venit_brut: 4500, str_chelt_deduc: 0, str_venit_net_anual: 4500,
    str_pierdere_anuala: 0, str_pierdere_precedenta: 0, str_pierdere_compensata: 0,
    str_venit_recalculat: 4500, str_impozit_datorat_Ro: 450, str_impozit_platit: 675,
    str_credit_fiscal: 450, str_dif_impozit_datorat: 0,
  }];
  const xml = buildD212Xml({ year: 2025, cap14Rows });
  assert.match(xml, /\sstr_venit_brut="4500"/);
  assert.match(xml, /\sstr_impozit_datorat_Ro="450"/);
  assert.match(xml, /\sstr_impozit_platit="675"/);
  // chelt_deduc still zero, still omitted
  assert.doesNotMatch(xml, /\sstr_chelt_deduc=/);
});

test('cap11 row: zero-valued inputs omitted, calculated outputs kept', () => {
  const cap11Rows = [{
    categ_venit: '1012', den_venit: 'X',
    venit_brut: 0, chelt_deduc: 0, venit_net_anual: 0,
    pierdere: 0, pierdere_precedenta: 0, pierdere_compensata: 0,
    venit_recalculat: 0, impozit11: 0, impozit_retinut: 0,
  }];
  const xml = buildD212Xml({ year: 2025, cap11Rows });
  assert.doesNotMatch(xml, /\svenit_brut=/);
  assert.doesNotMatch(xml, /\schelt_deduc=/);
  assert.doesNotMatch(xml, /\spierdere=/);
  assert.doesNotMatch(xml, /\spierdere_precedenta=/);
  assert.doesNotMatch(xml, /\simpozit11=/);
  assert.doesNotMatch(xml, /\simpozit_retinut=/);
  assert.doesNotMatch(xml, /\sden_venit=/);
  assert.match(xml, /\svenit_net_anual="0"/);
  assert.match(xml, /\spierdere_compensata="0"/);
  assert.match(xml, /\svenit_recalculat="0"/);
});

test('output structure matches the ANAF DUF golden fixture (cap14 + root)', () => {
  // The fixture in test/fixtures/d212-sample-anaf.xml is an anonymized D212
  // generated by the official ANAF DUF portal. We cannot byte-equal it: the
  // donor includes a PFA cap11 block (categ_venit=1016) and an oblig_realizat
  // block we do not emit yet. But the cap14 row + root-level attribute style
  // MUST match — that is the contract this test enforces.
  const fs = require('node:fs');
  const path = require('node:path');
  const golden = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'd212-sample-anaf.xml'),
    'utf8'
  );

  assert.match(golden, /xmlns:xsi="http:\/\/www\.w3\.org\/2001\/XMLSchema-instance"/);
  assert.match(golden, /xsi:schemaLocation="mfp:anaf:dgti:d212:declaratie:v11"/);
  assert.match(golden, /\sluna_r="12"/);

  const ours = buildD212Xml({
    year: 2025,
    cap14Rows: [{
      str_stat_realiz_v: 'US', str_categ_venit: '2012', dubla_impunere: '1',
      str_venit_brut: 0, str_chelt_deduc: 0, str_venit_net_anual: 0,
      str_pierdere_anuala: 0, str_pierdere_precedenta: 0, str_pierdere_compensata: 0,
      str_venit_recalculat: 0, str_impozit_datorat_Ro: 0, str_impozit_platit: 0,
      str_credit_fiscal: 0, str_dif_impozit_datorat: 0,
    }],
  });

  // Zero-input attrs dropped on both
  const dropped = [
    /\sstr_venit_brut=/, /\sstr_chelt_deduc=/, /\sstr_pierdere_anuala=/,
    /\sstr_pierdere_precedenta=/, /\sstr_impozit_datorat_Ro=/,
    /\sstr_impozit_platit=/, /\sden_stat=/, /\sden_categ_venit=/,
  ];
  for (const re of dropped) {
    assert.doesNotMatch(golden, re);
    assert.doesNotMatch(ours, re);
  }

  // Zero-output attrs kept on both
  const kept = [
    /\sstr_venit_net_anual="0"/, /\sstr_pierdere_compensata="0"/,
    /\sstr_venit_recalculat="0"/, /\sstr_credit_fiscal="0"/,
    /\sstr_dif_impozit_datorat="0"/,
  ];
  for (const re of kept) {
    assert.match(golden, re);
    assert.match(ours, re);
  }
});

test('emits <oblig_realizat> element + sets bifa132=1 when obligRealizat provided', () => {
  const xml = buildD212Xml({
    year: 2025,
    obligRealizat: {
      cass_ven_inv: 100000,
      cass_total_ven: 100000,
      cass_baza: 97200,
      cass_anuala: 9720,
      cass_datorat: 9720,
      cass_dif_plus: 9720,
      bifa_cass_real: '3',
      impozit_venit_plus: 5000,
      impozit_venit_minus: 0,
      cass_plus: 9720,
      dif_de_plata: 14720,
      dif_de_restituit: 0,
      venit_ret_inv: 100000,
    },
  });
  assert.match(xml, /<oblig_realizat\b[^/]*\scass_ven_inv="100000"/);
  assert.match(xml, /\scass_baza="97200"/);
  assert.match(xml, /\sbifa_cass_real="3"/);
  assert.match(xml, /\sdif_de_plata="14720"/);
  // bifa132 derived from cass_anuala > 0
  assert.match(xml, /\sbifa132="1"/);
});

test('no <oblig_realizat> + bifa132=0 when block not provided', () => {
  const xml = buildD212Xml({ year: 2025 });
  assert.doesNotMatch(xml, /<oblig_realizat/);
  assert.match(xml, /\sbifa132="0"/);
});

test('<oblig_realizat> emitted BEFORE cap11/cap14 (matches DUF order)', () => {
  const xml = buildD212Xml({
    year: 2025,
    cap11Rows: [{ categ_venit: '1012', venit_net_anual: 100, pierdere_compensata: 0, venit_recalculat: 100 }],
    cap14Rows: [{
      str_stat_realiz_v: 'US', str_categ_venit: '2012', dubla_impunere: '1',
      str_venit_net_anual: 0, str_pierdere_compensata: 0, str_venit_recalculat: 0,
      str_credit_fiscal: 0, str_dif_impozit_datorat: 0,
    }],
    obligRealizat: {
      cass_ven_inv: 100000, cass_anuala: 9720,
    },
  });
  const obligPos = xml.indexOf('<oblig_realizat');
  const cap11Pos = xml.indexOf('<cap11');
  const cap14Pos = xml.indexOf('<cap14');
  assert.ok(obligPos > 0, 'oblig_realizat present');
  assert.ok(obligPos < cap11Pos, 'oblig_realizat before cap11');
  assert.ok(cap11Pos < cap14Pos, 'cap11 before cap14');
});

