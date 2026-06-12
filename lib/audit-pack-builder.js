/**
 * Audit-pack builder (P3 — ANAF defensive bundle).
 *
 * Produces a ZIP archive containing every supporting document a third
 * party (accountant, ANAF inspector, the user 5 years from now) needs to
 * reproduce every number on the user's D212 declaration. The archive is
 * deterministic — same inputs → byte-identical output — so the user can
 * verify integrity via SHA-256 checksum.
 *
 * Contents (per the ROADMAP P3 spec):
 *   README.md                       — explains the bundle, how to verify
 *   methodology.md                  — snapshot of the rules catalog
 *   year-data.json                  — full computed values
 *   broker-statements-raw-text/     — anonymized raw PDF text per source
 *   parsed-data/                    — parsed JSON per source
 *   exchange-rates.json             — BNR rates used
 *   calculation-trace.txt           — per-category formula + inputs
 *
 * Privacy
 * -------
 * The pack contains POTENTIALLY SENSITIVE DATA (broker statements,
 * computed amounts). It is built locally and NEVER posted to any
 * external service — the server endpoint streams it directly back to
 * the browser. Users should treat the file like a tax return.
 */

'use strict';

const { buildZip } = require('./minizip');
const { BNR_EXCHANGE_RATES } = require('./rates');
const { RULES, CATEGORIES, getRulesByCategory } = require('./rules-catalog');

/**
 * Build the audit pack ZIP buffer.
 *
 * @param {object} input
 * @param {number} input.year                Fiscal year being audited.
 * @param {object} input.yearData            Output of getYearData (parsed broker data + manual fields).
 * @param {object} [input.computed]          Output of computeYearData if available (server typically lacks this).
 * @param {Array<{name: string, content: string}>} [input.rawFiles]  Anonymized raw text per source.
 * @param {string} [input.generatedXml]      D-7 XML output, if present.
 * @param {string} [input.appVersion]        From package.json — for traceability.
 * @returns {Buffer}                         ZIP archive bytes.
 */
function buildAuditPack(input) {
  const { year, yearData, computed, rawFiles, generatedXml, appVersion } = input || {};
  if (!year || !yearData) {
    throw new Error('buildAuditPack: year and yearData are required');
  }

  // Deterministic clock: use a fixed timestamp based on the input year
  // so re-runs produce byte-identical archives. Users get a real
  // timestamp at filename level (the route builds that).
  const buildTimestamp = `${year}-01-01T00:00:00Z`;

  const entries = [];
  const add = (name, content) => entries.push({ name, content });

  // 1. README (Romanian — primary audience is Romanian accountants).
  add('README.md', buildReadme({ year, appVersion, buildTimestamp }));

  // 2. Methodology (rules catalog snapshot).
  add('methodology.md', buildMethodologyMarkdown());

  // 3. Year data (raw input — what we computed FROM).
  add('year-data.json', JSON.stringify(stableSort(yearData), null, 2));

  // 4. Computed values (what we computed TO — optional, only if caller passed it).
  if (computed) {
    add('computed-values.json', JSON.stringify(stableSort(computed), null, 2));
  }

  // 5. BNR exchange rates for this year (and adjacent years for context).
  const ratesContext = {};
  for (const y of [year - 1, year, year + 1]) {
    if (BNR_EXCHANGE_RATES[y]) ratesContext[y] = BNR_EXCHANGE_RATES[y];
  }
  add('exchange-rates.json', JSON.stringify(ratesContext, null, 2));

  // 6. Raw broker statements (anonymized text, not original PDFs).
  // Sorted by name for deterministic ordering.
  const sortedRaw = (rawFiles || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  for (const f of sortedRaw) {
    add(`broker-statements-raw-text/${f.name}`, f.content);
  }

  // 7. Parsed structured data per known broker. Pulled out of yearData so
  // accountants can see exactly which numbers came from which parser
  // without grepping through the monolithic year-data.json.
  const parsedSlots = [
    ['fidelityTrades', 'fidelity-trades.json'],
    ['fidelityData', 'fidelity-data.json'],
    ['xtbPortfolio', 'xtb-portfolio.json'],
    ['xtbDividendsReport', 'xtb-dividends.json'],
    ['btPortfolio', 'bt-portfolio.json'],
    ['btDividendsReport', 'bt-dividends.json'],
    ['tradevillePortfolio', 'tradeville-portfolio.json'],
    ['revolutStatement', 'revolut-statement.json'],
    ['msStatement', 'morgan-stanley-statement.json'],
    ['form1042s', 'form-1042s.json'],
    ['declaratie', 'anaf-d212-import.json'],
  ];
  for (const [key, fname] of parsedSlots) {
    if (yearData[key] != null) {
      add(`parsed-data/${fname}`, JSON.stringify(stableSort(yearData[key]), null, 2));
    }
  }

  // 8. Calculation trace (human-readable). Builds a step-by-step derivation
  // if `computed` is available; otherwise emits a placeholder explaining
  // where to find it in the live app.
  add('calculation-trace.txt', buildCalculationTrace({ year, yearData, computed }));

  // 9. Generated D212 XML (D-7 output) if present.
  if (generatedXml) {
    add(`generated-d212-${year}.xml`, generatedXml);
  }

  // 10. Manifest with file ordering + sizes for integrity verification.
  // Built last so it captures the full file list.
  const manifest = entries.map((e) => ({
    name: e.name,
    size: Buffer.byteLength(typeof e.content === 'string' ? e.content : e.content),
  }));
  add('MANIFEST.json', JSON.stringify({ year, appVersion, buildTimestamp, entries: manifest }, null, 2));

  return buildZip(entries);
}

/**
 * Recursively sort object keys for deterministic JSON serialization.
 * Arrays keep their order; objects get their keys sorted lexicographically.
 */
function stableSort(value) {
  if (Array.isArray(value)) {
    return value.map(stableSort);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = stableSort(value[k]);
    }
    return out;
  }
  return value;
}

function buildReadme({ year, appVersion, buildTimestamp }) {
  return `# D212 Audit Pack — anul fiscal ${year}

Acest pachet conține TOATE documentele necesare pentru a verifica și reproduce
fiecare cifră din Declarația Unică D212 (formularul ${year + 1}) pe care
utilizatorul a depus-o la ANAF pentru anul fiscal ${year}.

Generat de: D212TaxHelper${appVersion ? ` v${appVersion}` : ''}
Build timestamp (deterministic): ${buildTimestamp}

## Audiență

- Auditori ANAF în cazul unei verificări
- Contabili care vor să verifice un calcul
- Utilizatorul în sine, peste 5 ani, când nu-și mai amintește ce s-a întâmplat

## Conținut

| Fișier | Descriere |
|---|---|
| \`README.md\` | Acest fișier |
| \`methodology.md\` | Catalogul de reguli fiscale aplicate (citate Cod fiscal + Instr. D212) |
| \`year-data.json\` | Date de intrare (rezultatul parser-elor + intrări manuale) |
| \`computed-values.json\` | Valori calculate (output computeYearData) — opțional, prezent dacă a fost rulat în UI |
| \`exchange-rates.json\` | Cursurile BNR medii anuale folosite la conversia valutară |
| \`broker-statements-raw-text/\` | Text extras din PDF-urile broker (PII deja anonimizate) |
| \`parsed-data/\` | Date parsate pe sursă (fidelity, xtb, bt, etc.) |
| \`calculation-trace.txt\` | Derivarea pas cu pas a fiecărei cifre |
| \`generated-d212-${year}.xml\` | XML-ul D212 generat (dacă a fost exportat) |
| \`MANIFEST.json\` | Listă completă fișiere + dimensiuni — pentru verificare integritate |

## Cum se verifică

1. Verifică \`MANIFEST.json\` împotriva listei fișierelor din ZIP — trebuie să corespundă.
2. Citește \`methodology.md\` pentru regulile aplicate și cotele per an.
3. Pornind de la \`year-data.json\`, urmărește calculele în \`calculation-trace.txt\`.
4. Compară cu \`computed-values.json\` (dacă există).
5. Pentru verificare manuală: descarcă PDF-urile originale de la broker / ANAF și
   compară valorile cu cele din \`parsed-data/\` și \`broker-statements-raw-text/\`.

## Trei pași pentru a reproduce numerele

\`\`\`bash
# 1. Verifică sumele de control ale cursurilor
cat exchange-rates.json | jq '.["${year}"]'

# 2. Vezi totalul venituri din dividende
cat year-data.json | jq '.xtbDividendsReport.dividends, .btDividendsReport.dividends, .fidelityData.dividends'

# 3. Vezi rezultatul final
cat computed-values.json | jq '.totalTax, .cassTax, .refundOwedRON'
\`\`\`

## Reproducibilitate

Pachetul este construit DETERMINISTIC. Două rulări cu aceleași date de intrare
produc arhive ZIP byte-identice. Verifică checksum-ul SHA-256:

\`\`\`bash
sha256sum D212-audit-pack-${year}-*.zip
\`\`\`

## Confidențialitate

Acest pachet conține date sensibile (sume, identificatori broker). NU îl
trimiteți prin email, NU îl încărcați pe servicii cloud nesecurizate. Este
construit local de aplicația D212TaxHelper și nu este transmis nicăieri în
afară de browser-ul utilizatorului.

## Surse

- Cod fiscal: Legea 227/2015, art. 91-99, 114, 119, 130, 170, 174^1.
- Instrucțiuni D212: OMF 2736/2025 (Instructiuni_D212_OMF_2736_2025.pdf).
- Cursurile BNR: https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice
- Aplicația: https://github.com/edspat/D212TaxHelper

## Contact / contribuții

Dacă găsești o regulă lipsă sau o discrepanță, deschide un issue:
https://github.com/edspat/D212TaxHelper/issues/new?template=missing-rule.md
`;
}

function buildMethodologyMarkdown() {
  let md = `# Reguli fiscale aplicate

Snapshot al catalogului de reguli din \`lib/rules-catalog.js\`. Fiecare regulă
trebuie verificată împotriva surselor oficiale citate.

`;
  const grouped = getRulesByCategory();
  for (const [catKey, catLabel] of Object.entries(CATEGORIES)) {
    const rules = grouped[catKey] || [];
    if (rules.length === 0) continue;
    md += `\n## ${catLabel}\n\n`;
    for (const r of rules) {
      md += `### ${r.title}\n\n`;
      md += `- **Cote impozit:** ${r.taxRates.join('; ')}\n`;
      md += `- **Cod fiscal:** ${r.lawArticle}\n`;
      md += `- **Instrucțiuni D212:** ${r.instructionParagraph}\n`;
      md += `- **Implementare:** \`${r.codeRef}\`\n`;
      md += `- **Verificat ultima dată:** ${r.lastVerified}\n\n`;
      md += `**Formulă:**\n\n\`\`\`\n${r.formula.join('\n')}\n\`\`\`\n\n`;
      if (r.narrative) {
        md += `${r.narrative}\n\n`;
      }
      if (r.example) {
        md += `**Exemplu:**\n\n_Intrare:_ ${r.example.input}\n\n_Ieșire:_\n\n\`\`\`\n${r.example.output}\n\`\`\`\n\n`;
      }
    }
  }
  return md;
}

function buildCalculationTrace({ year, yearData, computed }) {
  let txt = `D212 — Calculation Trace pentru anul fiscal ${year}\n`;
  txt += `${'='.repeat(60)}\n\n`;
  if (!computed) {
    txt += `(computed-values.json nu este disponibil — generat-l din UI pentru detaliu complet)\n\n`;
    txt += `Pentru a re-genera: deschide D212TaxHelper, alege anul ${year}, exportă audit pack-ul din UI (Dashboard).\n`;
    return txt;
  }
  txt += `Surse de venit detectate:\n`;
  txt += `${'-'.repeat(60)}\n`;
  const srcChecks = [
    ['xtbDividendsReport', 'XTB Dividende'],
    ['xtbPortfolio', 'XTB Portofoliu (capgains)'],
    ['btDividendsReport', 'BT Capital Dividende'],
    ['btPortfolio', 'BT Capital Portofoliu'],
    ['tradevillePortfolio', 'Tradeville Portofoliu'],
    ['fidelityTrades', 'Fidelity (RSU/ESPP)'],
    ['msStatement', 'Morgan Stanley'],
    ['form1042s', 'Form 1042-S (US)'],
    ['revolutStatement', 'Revolut Securities (LT)'],
    ['adeverinta', 'Adeverință venituri'],
  ];
  for (const [k, label] of srcChecks) {
    const present = yearData[k] != null && (typeof yearData[k] !== 'object' || Object.keys(yearData[k] || {}).length > 0);
    txt += `  ${present ? '✓' : ' '} ${label.padEnd(40)} ${present ? '(prezent)' : ''}\n`;
  }
  txt += `\nValori-cheie calculate:\n`;
  txt += `${'-'.repeat(60)}\n`;
  const keyFields = [
    ['dividendsRON', 'Dividende US (RON, brut)'],
    ['dividendsRON_ro', 'Dividende RO broker (RON, brut total)'],
    ['roDivLocalRON', 'Dividende RO source via broker RO (RON)'],
    ['roDivForeignTaxWithheldRON', 'Impozit reținut străinătate pe div. via RO broker'],
    ['capitalGainsTaxableRON', 'Capgains US taxabile (RON)'],
    ['roLongTermGainRON', 'Capgains RO ≥1 an (RON)'],
    ['roShortTermGainRON', 'Capgains RO <1 an (RON)'],
    ['interestIncomeRON', 'Dobânzi (RON, total)'],
    ['totalDividendsRON', 'Total dividende (RON)'],
    ['totalCapitalGainsRON', 'Total câștiguri capital (RON)'],
    ['dividendTaxRON', 'Impozit dividende datorat (RON)'],
    ['capitalGainsTaxRON', 'Impozit capgains datorat (RON)'],
    ['interestTax', 'Impozit dobânzi datorat (RON)'],
    ['incomeTaxOnly', 'Total impozit pe venit (RON)'],
    ['cassTax', 'CASS datorat (RON)'],
    ['totalTax', 'TOTAL DE PLATĂ — impozit + CASS (RON)'],
    ['totalAlreadyPaid', 'Total deja reținut la sursă (RON)'],
    ['refundOwedRON', 'De restituit (RON, dacă > 0)'],
    ['d212NetCashFlowRON', 'Cash flow net D212 (pozitiv = de plată, negativ = restituire)'],
  ];
  for (const [k, label] of keyFields) {
    if (computed[k] != null) {
      const val = typeof computed[k] === 'number' ? computed[k].toLocaleString('ro-RO', { maximumFractionDigits: 2 }) : computed[k];
      txt += `  ${label.padEnd(50)} = ${val}\n`;
    }
  }
  txt += `\nLinii cap11 (Câștiguri RO):\n`;
  txt += `${'-'.repeat(60)}\n`;
  for (const row of (computed.cap11Rows || [])) {
    txt += `  categ_venit=${row.categ_venit}: brut=${row.venit_brut}, pierdere=${row.pierdere}, recalculat=${row.venit_recalculat}, impozit=${row.impozit11}, reținut=${row.impozit_retinut}\n`;
  }
  txt += `\nLinii cap14 (Venituri din străinătate):\n`;
  txt += `${'-'.repeat(60)}\n`;
  for (const row of (computed.cap14Rows || [])) {
    txt += `  ${row.str_stat_realiz_v} cat=${row.str_categ_venit}: brut=${row.str_venit_brut}, net=${row.str_venit_net_anual}, impozit_RO=${row.str_impozit_datorat_Ro}, plătit străinătate=${row.str_impozit_platit}, credit=${row.str_credit_fiscal}, diferență=${row.str_dif_impozit_datorat}\n`;
  }
  return txt;
}

module.exports = { buildAuditPack, stableSort };
