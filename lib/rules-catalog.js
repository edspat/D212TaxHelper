/**
 * Rules & References catalog.
 *
 * Single source of truth for the human-readable rules page consulted by
 * Romanian fiscal accountants and auditors. Each entry maps one ANAF /
 * Cod fiscal rule to its corresponding implementation in this codebase.
 *
 * Why this file exists
 * --------------------
 * `computeYearData` in `public/js/app.js` is ~1000 lines of fiscal math.
 * Without an explicit catalog, an accountant has no way to verify that
 * a specific tax rule was implemented correctly without reading the JS.
 * This catalog gives every rule its own card on the "Reguli & Referințe"
 * page with the citation, formula, example, and a pointer to the code.
 *
 * Editing this file
 * -----------------
 * - Add rules in declaration order (the page renders top-down).
 * - Romanian text in `category`, `formula`, `narrative` — these are the
 *   *legal* text and stay untranslated. The chrome (page title, button
 *   labels, "see code", etc.) lives in `public/locales/`.
 * - Always cite BOTH `lawArticle` (Cod fiscal) AND `instructionParagraph`
 *   (Instrucțiuni D212 OMF 2736/2025) — discrepancies between them
 *   happen and are valuable to surface.
 * - `codeRef` must point at the current line in the canonical
 *   implementation. Bump it after refactors.
 * - `lastVerified` is the YYYY-MM-DD date you cross-checked the rule
 *   against the official PDF. Stale rules get a visual warning.
 *
 * Submitting additions
 * --------------------
 * Accountants who notice a missing rule can open an issue via
 * `.github/ISSUE_TEMPLATE/missing-rule.md`.
 */

'use strict';

/**
 * @typedef {object} Rule
 * @property {string} id            Stable kebab-case identifier (slug).
 * @property {string} category      One of CATEGORIES below — drives grouping.
 * @property {string} title         Romanian title shown on the card.
 * @property {string[]} taxRates    Per-year RO tax rates (display strings).
 * @property {string} lawArticle    Cod fiscal article citation.
 * @property {string} instructionParagraph  Instr. D212 § citation.
 * @property {string[]} formula     Multi-line formula (verbatim from source).
 * @property {string} [narrative]   Short explanatory note (optional).
 * @property {object} [example]     Worked example { input, output }.
 * @property {string} codeRef       Path:LINE pointer to the implementation.
 * @property {string[]} [seeAlso]   Cross-references to other rule ids.
 * @property {string} lastVerified  YYYY-MM-DD — when this card was checked.
 */

const CATEGORIES = {
  dividends: '💰 Dividende',
  capitalGains: '📈 Câștiguri din transferul titlurilor de valoare',
  interest: '🏦 Dobânzi',
  rental: '🏠 Cedarea folosinței bunurilor',
  royalty: '✍️ Drepturi de proprietate intelectuală',
  gambling: '🎲 Venituri din jocuri de noroc',
  other: '🌐 Alte venituri',
  losses: '➖ Pierderi reportate',
  cass: '🩺 Contribuția la asigurări sociale de sănătate (CASS)',
  fx: '💱 Curs de schimb BNR',
};

/** @type {Rule[]} */
const RULES = [
  // --- Dividende ---
  {
    id: 'dividends-ro-source',
    category: 'dividends',
    title: 'Dividende din surse din România (final tax la sursă)',
    taxRates: [
      '2023-2024: 8%',
      '2025: 10% (OUG 156/2024 art. III)',
      '2026+: 10%',
    ],
    lawArticle: 'Cod fiscal art. 91 alin. (2), art. 97 alin. (7)',
    instructionParagraph: 'Instr. D212 § 7.3 (cap11) și § 49 (CASS)',
    formula: [
      'impozit_RO  = gross × cota',
      'impozit_final → reținut la sursă de plătitor (broker RO, depozitar central)',
      'NU se reemite în cap11 (nu există cod în Nomenclator_venituri_RO pentru PF)',
      'Intră în baza CASS NET (după scăderea impozitului reținut) — pct.51',
    ],
    narrative:
      'Dividendele de la emitenți români primite prin broker român (XTB, BT, Tradeville etc.) sau direct (depozitar central pentru BVB) se impozitează cu reținere finală la sursă. Plătitorul emite D205 categoria 20. Nu se mai re-impozitează în D212 cap11, dar valoarea netă (după impozit) intră în baza CASS.',
    codeRef: 'public/js/app.js:1830 (resolveRoBrokerDividends + dividendTaxRON local branch)',
    seeAlso: ['cass-base-investment', 'dividends-foreign-source'],
    lastVerified: '2026-05-25',
  },
  {
    id: 'dividends-foreign-source',
    category: 'dividends',
    title: 'Dividende din străinătate (cap14, str_categ_venit=2018)',
    taxRates: [
      '2023-2024: 8% în RO',
      '2025: 10% în RO (după OUG 156/2024)',
      '2026+: 10% în RO',
    ],
    lawArticle: 'Cod fiscal art. 91, art. 130 (metoda creditului fiscal)',
    instructionParagraph: 'Instr. D212 § 39.6.10-11',
    formula: [
      'impozit_RO       = grossRON × cota',
      'credit_fiscal    = min(impozit_RO, impozit_platit_strainatate)',
      'dif_de_plata     = max(0, impozit_RO − credit_fiscal)',
      'Excedentul de impozit străin (impozit_platit > credit_fiscal) NU se recuperează prin D212.',
    ],
    narrative:
      'Plătitorul real este emitentul străin, NU intermediarul român. Broker-ul român doar custodiază. Se declară în cap14 cu cod 2018, per țară (str_stat_realiz_v). Pentru rezident RO cu W-8BEN, reținerea la sursă US este 10% (tratat US-RO art. 10), care depășește creditul cap-uit la 8/10% RO → 0 RON de plată în RO.',
    example: {
      input: 'Apple dividende: $500 gross, $50 WHT US (10% W-8BEN). USD-RON 2025 = 4.4705.',
      output:
        'gross_RON = 2235.25\nimpozit_RO (8%) = 178.82\ncredit_fiscal = min(178.82, 223.53) = 178.82\ndif_de_plata = 0\nexces foreign (44.71) = pierdut',
    },
    codeRef: 'public/js/app.js:2160 (cap14Rows.push for foreign dividends, merged per country)',
    seeAlso: ['fx-bnr', 'dividends-ro-source'],
    lastVerified: '2026-05-25',
  },

  // --- Capital gains ---
  {
    id: 'capgains-ro-source',
    category: 'capitalGains',
    title: 'Câștiguri RO din transferul titlurilor de valoare (cap11, categ_venit=1012)',
    taxRates: [
      '2019-2022: 10% (cotă unică)',
      '2023-2025: 1% pentru ≥365 zile, 3% pentru <365 zile',
      '2026+: 3% pentru ≥365 zile, 6% pentru <365 zile',
    ],
    lawArticle: 'Cod fiscal art. 94 alin. (1) lit. a) și art. 97 alin. (9)',
    instructionParagraph: 'Instr. D212 § 7.3.1 (cap11 Rd.1-Rd.9)',
    formula: [
      'venit_brut          = Σ câștiguri pe buckete (≥1y + <1y), GROS — fără scădere pierderi',
      'pierdere            = pierderea netă a anului curent (din pierderi > câștiguri pe bucket)',
      'pierdere_compensata = min(pierdere_precedenta, 0.70 × venit_net_anual)   /* Rd.6 */',
      'venit_recalculat    = venit_net_anual − pierdere_compensata',
      'impozit11           = Σ(bucket_gain_net × cota_bucket)',
      'impozit_retinut     = total reținut de broker (la sursă, per tranzacție profitabilă)',
    ],
    narrative:
      'Broker-ul român reține impozit la sursă PE FIECARE TRANZACȚIE profitabilă, nu pe netul anual — de aceea D205 categoriile 26/27 raportează GROS. Pierderile se compensează în D212 (cap11 Rd.6) și pot rezulta în restituire dacă reținerea brută depășește impozitul datorat pe net.',
    example: {
      input: '10 vânzări <1y: total câștig 427.094 RON, pierderi 37.699 RON, broker reținut 12.812 RON.',
      output:
        'venit_brut (Rd.1) = 427.094  (GROS — pentru D205)\npierdere (Rd.4) = 37.699\nvenit_net_anual = 389.395\nimpozit11 (Rd.8) = 389.395 × 3% = 11.682\nimpozit_retinut (Rd.9) = 12.812\nde restituit = 1.130 RON',
    },
    codeRef: 'lib/d212-cap11.js:70 (buildCap11Rows)',
    seeAlso: ['losses-carryforward', 'capgains-foreign-source'],
    lastVerified: '2026-05-25',
  },
  {
    id: 'capgains-foreign-source',
    category: 'capitalGains',
    title: 'Câștiguri din străinătate (cap14, str_categ_venit=2012)',
    taxRates: [
      '2023-2025: 10% (cotă unică în RO, fără bucket)',
      '2026+: 10% (cotă unică)',
    ],
    lawArticle: 'Cod fiscal art. 94 alin. (1) lit. a), art. 130',
    instructionParagraph: 'Instr. D212 § 39.6.4-7',
    formula: [
      'venit_brut       = prețul de vânzare în RON (cumpărări × FX BNR scădute în Rd.2)',
      'chelt_deduc      = cost de achiziție + BIK deja impozitată ca salariu (RSU/ESPP)',
      'venit_net_anual  = max(0, venit_brut − chelt_deduc)',
      'impozit_RO       = venit_net_anual × 10%',
      'credit_fiscal    = min(impozit_RO, impozit_platit_strainatate)',
      'dif_de_plata     = max(0, impozit_RO − credit_fiscal)',
    ],
    narrative:
      'US capgains: brokerul SUA nu reține impozit pentru rezident RO (W-8BEN). Tratatul US-RO art. 13 lasă impozitarea pe stat de rezidență. Pentru BIK din vesting RSU/ESPP, costul deductibil include valoarea deja impozitată ca venit salarial (Cod fiscal art. 76 alin. (3) + § 7.4). Revolut (broker LT): aceeași tratare, cu str_impozit_platit=0.',
    codeRef: 'lib/d212-cap14.js:130 (buildCap14Rows capital gains row)',
    seeAlso: ['salary-bik', 'fx-bnr'],
    lastVerified: '2026-05-25',
  },

  // --- Interest ---
  {
    id: 'interest-ro',
    category: 'interest',
    title: 'Dobânzi din depozite RO (final la sursă)',
    taxRates: [
      '2023-2025: 10%',
      '2026+: 16% (OUG 156/2024)',
    ],
    lawArticle: 'Cod fiscal art. 98, art. 97 alin. (2)',
    instructionParagraph: 'Instr. D212 § 49.4 (CASS, intră NET)',
    formula: [
      'impozit_final reținut de bancă la sursă',
      'NU se re-emite în cap11',
      'Intră în baza CASS NET (după impozit) — pct.51',
    ],
    narrative:
      'Banca raportează D205 categoria 09. Adeverința bancară conține dobânda brută și impozitul reținut.',
    codeRef: 'public/js/app.js:1738 (resolveInterest)',
    lastVerified: '2026-05-25',
  },
  {
    id: 'interest-foreign-us',
    category: 'interest',
    title: 'Dobânzi US (1042-S cod 01, str_categ_venit=2010)',
    taxRates: [
      '2023-2025: 10% în RO',
      '2026+: 16% în RO',
    ],
    lawArticle: 'Cod fiscal art. 98, art. 130 (credit); IRC §871(h) (US portfolio interest exemption)',
    instructionParagraph: 'Instr. D212 § 39.6.8-9',
    formula: [
      'impozit_RO       = grossRON × cota',
      'credit_fiscal    = min(impozit_RO, federal_tax_withheld) — de regulă 0 (US §871h)',
      'dif_de_plata     = max(0, impozit_RO − credit_fiscal) = impozit_RO',
    ],
    narrative:
      'US aplică portfolio interest exemption — reține 0% pentru rezidenți non-US cu W-8BEN. Rezultatul: rezidentul RO datorează cota RO integrală pe gross, fără credit fiscal semnificativ.',
    codeRef: 'lib/d212-cap14.js:166 (buildCap14Rows interest row, categ_venit=2010)',
    lastVerified: '2026-05-25',
  },

  // --- BIK ---
  {
    id: 'salary-bik',
    category: 'capitalGains',
    title: 'Beneficii în natură (BIK) — vesting RSU / ESPP discount',
    taxRates: [
      'Impozitate ca salariu la momentul vesting/exercise (cota globală 10% + CASS + CAS)',
    ],
    lawArticle: 'Cod fiscal art. 76 alin. (3), art. 94 alin. (4)',
    instructionParagraph: 'Instr. D212 § 7.4',
    formula: [
      'BIK la vesting = FMV_la_vest − cost_user (pentru RSU: cost=0)',
      'BIK impozitat ca salariu prin angajator (RO)',
      'La vânzare ulterioară: chelt_deduc = cost_FMV_la_vest = include BIK deja impozitată',
      'Astfel se evită dublă impozitare a aceleiași valori',
    ],
    narrative:
      'Pentru RSU/ESPP: angajatorul reține impozitul + contribuții pe valoarea de piață la vesting (FMV). Când vinzi acțiunile, cost basis fiscal = FMV de la vest (nu costul tău de $0). Diferența venit-cost = câștigul real pe care îl impozitezi la 10% RO.',
    codeRef: 'public/js/app.js:1750 (resolveSalaryBIK + capGainsCost includes salaryTaxedRON)',
    seeAlso: ['capgains-foreign-source'],
    lastVerified: '2026-05-25',
  },

  // --- Losses ---
  {
    id: 'losses-carryforward',
    category: 'losses',
    title: 'Pierderi reportate (Rd.5-6) — reguli de compensare',
    taxRates: ['—'],
    lawArticle: 'Cod fiscal art. 119 alin. (1)-(2)',
    instructionParagraph: 'Instr. D212 § 7.3.3',
    formula: [
      'pierdere_precedenta  = suma pierderilor disponibile (max 7 ani precedenți)',
      'pierdere_compensata  = min(pierdere_precedenta, 0.70 × venit_net_anual)',
      'pierdere_carry_next  = pierdere_precedenta − pierdere_compensata + pierdere_anuala',
    ],
    narrative:
      'Pierderile se compensează MAXIM 70% din câștigul net. Cele rămase se reportează 7 ani. IMPORTANT (art. 119): pierderile de aceeași natură — pierderile RO nu compensează câștiguri din străinătate și viceversa. Aplicația tratează `yd.priorLosses` ca pool RO (gap D-5 pentru split foreign).',
    codeRef: 'public/js/app.js:1860 (priorLossesApplied = min(priorLossesAvailable, 0.70 × totalRoCapGains))',
    lastVerified: '2026-05-25',
  },

  // --- CASS ---
  {
    id: 'cass-thresholds',
    category: 'cass',
    title: 'Plafoane CASS pentru venituri din investiții (2025)',
    taxRates: [
      '6 SM: 19.800 RON (3.300 × 6) — CASS 10% × 19.800 = 1.980',
      '12 SM: 39.600 RON — CASS 10% × 39.600 = 3.960',
      '24 SM: 79.200 RON — CASS 10% × 79.200 = 7.920',
    ],
    lawArticle: 'Cod fiscal art. 170 alin. (2), art. 174^1 alin. (1)',
    instructionParagraph: 'Instr. D212 § 49-51 (cap22 + pct.50/51)',
    formula: [
      'base CASS = max(plafon_aplicabil, NU 0 dacă venitul depășește pragul) — cota 10%',
      'IMPORTANT: plafonul 60 SM se aplică doar la activități independente / freelance,',
      '          NU la investiții (Cod fiscal art. 174^1 alin. (4)). Pentru investiții',
      '          plafonul maxim este 24 SM.',
    ],
    narrative:
      'Eroare frecventă: aplicarea plafonului 60 SM la dividende/capgains. Codul fiscal limitează venitul din investiții la 24 SM (Cod fiscal art. 174^1 alin. (4)). Aplicația implementează corect doar tier-urile 6/12/24 SM pentru investiții.',
    codeRef: 'lib/d212-cap11.js → calculateCASS (defined in public/js/app.js)',
    seeAlso: ['cass-base-investment', 'cass-pfa-separate'],
    lastVerified: '2026-05-26',
  },
  {
    id: 'cass-pfa-separate',
    category: 'cass',
    title: 'CASS este DATORAT SEPARAT pe categorii (PFA vs investiții vs chirii etc.)',
    taxRates: ['Plafon: 6/12/24 SM per categorie (cota 10%)'],
    lawArticle: 'Cod fiscal art. 155 alin. (1) lit. b)-h), art. 170, art. 174^1',
    instructionParagraph: 'Instr. D212 cap I §3 subsec 2.1 (PFA) + subsec 2.2 (investiții/altele) — completate separat',
    formula: [
      'CASS PFA       = calc 6/12/24 SM(venit_net_PFA)',
      'CASS investiții = calc 6/12/24 SM(venit_total_investiții)',
      'CASS chirii    = calc 6/12/24 SM(venit_net_chirii)',
      'CASS_total     = CASS_PFA + CASS_investiții + CASS_chirii + ...',
      '',
      'NU se cumulează veniturile între categorii pentru încadrarea în plafon!',
      'Fiecare categorie are propriul prag și propria bază.',
    ],
    narrative:
      'Pe declarația D212 cap I §3 există subsecțiuni separate: 2.1 pentru CASS din activități independente (art. 155(1)b) și 2.2 pentru CASS din investiții/chirii/altele (art. 155(1)c-h). Fiecare subsecțiune își aplică propriul plafon 6/12/24 SM pe venitul net din categoria respectivă. Un contribuabil cu venit PFA 23.498 RON și venit investiții 517.132 RON datorează: CASS PFA = 12 SM × 10% = 2.430 RON (tier 12-24SM) + CASS investiții = 24 SM × 10% = 9.720 RON (tier >24SM) = TOTAL 12.150 RON.',
    example: {
      input: 'PFA 23.498 RON + investiții 517.132 RON, anul 2025 (SM=4.050).',
      output:
        'CASS PFA: 12 × 4.050 = 48.600 RON → tier 12-24SM → baza 24.300 → 2.430 RON\nCASS investiții: 24 × 4.050 = 97.200 RON → tier >24SM → baza 97.200 → 9.720 RON\nTOTAL CASS: 12.150 RON',
    },
    codeRef: 'public/js/app.js:2062-2080 (cassResult pentru investiții + pfaCassResult pentru PFA)',
    seeAlso: ['cass-thresholds', 'cass-base-investment'],
    lastVerified: '2026-05-26',
  },
  {
    id: 'cass-base-investment',
    category: 'cass',
    title: 'Compunerea bazei CASS — investment income',
    taxRates: ['—'],
    lawArticle: 'Cod fiscal art. 170 + art. 174^1; OMF 2736/2025 pct.51',
    instructionParagraph: 'Instr. D212 § 49-51, pct.51 specific',
    formula: [
      'dividende        → NET (gros − impozit_reținut)',
      'dobânzi          → NET (gros − impozit_reținut)',
      'câștiguri din investiții → NET (câștig − pierdere) — fără scădere impozit',
      'chirii (cap5)    → venit_net (după deducerea forfetară 40%)',
      'drepturi IP      → venit_net (după deducerea forfetară 40%)',
      'alte surse       → GROS (pct.51 + pct.50.1 lit. f)',
      'NU intră: jocuri de noroc (impozit final la sursă, art. 110)',
    ],
    narrative:
      'Regula NET vs GROS variază per categorie. Pentru dividende și dobânzi: net (după reținerea finală la sursă) — pentru că impozitul deja s-a plătit. Pentru capgains: net (câștig minus pierdere), pentru că aici câștigul real este net. Aplicația implementează exact aceste reguli — vezi testul de regresie `test/d212-integration.test.js: integration: RO broker over-withheld` și `test/d212-cap14.test.js`.',
    codeRef: 'public/js/app.js:1958 (totalDividendsRON_cass, totalInvestmentIncome_cass)',
    seeAlso: ['cass-thresholds'],
    lastVerified: '2026-05-25',
  },

  // --- Rental / Royalty / Gambling ---
  {
    id: 'rental-income',
    category: 'rental',
    title: 'Venituri din cedarea folosinței bunurilor (chirii)',
    taxRates: [
      '2023-2025: 10% pe venit net',
      '2026+: 16% pe venit net',
    ],
    lawArticle: 'Cod fiscal art. 83-85',
    instructionParagraph: 'Instr. D212 § 7.5',
    formula: [
      'venit_net = venit_brut × 60%   /* deducere forfetară 40% */',
      'impozit   = venit_net × cota',
      'Intră în baza CASS NET (pct.51)',
    ],
    codeRef: 'public/js/app.js:1933 (rentalNet, rentalTaxToPay)',
    lastVerified: '2026-05-25',
  },
  {
    id: 'royalty-income',
    category: 'royalty',
    title: 'Drepturi de proprietate intelectuală',
    taxRates: [
      '2023-2025: 10% pe venit net',
      '2026+: 16% pe venit net',
    ],
    lawArticle: 'Cod fiscal art. 71-73',
    instructionParagraph: 'Instr. D212 § 7.6',
    formula: [
      'venit_net = venit_brut × 60%   /* deducere forfetară 40% */',
      'impozit   = venit_net × cota',
      'Intră în baza CASS NET',
    ],
    codeRef: 'public/js/app.js:1939 (royaltyNet, royaltyTaxToPay)',
    lastVerified: '2026-05-25',
  },
  {
    id: 'gambling-income',
    category: 'gambling',
    title: 'Venituri din jocuri de noroc',
    taxRates: ['Final reținut la sursă — declarat pentru completitudine'],
    lawArticle: 'Cod fiscal art. 110-111',
    instructionParagraph: 'Instr. D212 § 9 (informativ)',
    formula: [
      'impozit reținut la sursă de organizator',
      'NU se re-impozitează în D212',
      'NU intră în baza CASS (art. 110 — venit final, excludere explicită)',
    ],
    codeRef: 'public/js/app.js:1942 (gamblingTaxTotal — surfaced for transparency only)',
    lastVerified: '2026-05-25',
  },

  // --- Other ---
  {
    id: 'other-income',
    category: 'other',
    title: 'Alte venituri (art. 114)',
    taxRates: [
      '2023-2025: 10%',
      '2026+: 16%',
    ],
    lawArticle: 'Cod fiscal art. 114-115',
    instructionParagraph: 'Instr. D212 § 7.7, pct.50.1 lit. f, pct.51',
    formula: [
      'impozit = venit_brut × cota',
      'Intră în baza CASS GROS (pct.51) — singura categorie de investment-like care intră GROS',
    ],
    codeRef: 'public/js/app.js:1945 (otherTaxDue, otherTaxToPay)',
    lastVerified: '2026-05-25',
  },

  // --- FX ---
  {
    id: 'fx-bnr',
    category: 'fx',
    title: 'Curs de schimb — BNR mediu anual',
    taxRates: ['—'],
    lawArticle: 'Cod fiscal art. 76 alin. (8); Cod fiscal art. 224 alin. (12)',
    instructionParagraph: 'Instr. D212 § 6.4 (FX BNR mediu anual)',
    formula: [
      'Pentru orice sumă în valută la o dată de plată,',
      'se utilizează cursul BNR mediu anual al anului fiscal,',
      'NU cursul de la data tranzacției.',
    ],
    narrative:
      'Sursa: https://www.bnr.ro/1975-cursul-de-schimb-serii-statistice. Aplicația folosește lib/rates.js: BNR_EXCHANGE_RATES (2019-2025 publicate de BNR la final de an).',
    codeRef: 'lib/rates.js:11 (BNR_EXCHANGE_RATES const)',
    lastVerified: '2026-05-25',
  },
];

function getRulesByCategory() {
  const grouped = {};
  for (const r of RULES) {
    (grouped[r.category] = grouped[r.category] || []).push(r);
  }
  return grouped;
}

const _exports = { CATEGORIES, RULES, getRulesByCategory };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = _exports;
}
if (typeof window !== 'undefined') {
  window.RulesCatalog = _exports;
}
