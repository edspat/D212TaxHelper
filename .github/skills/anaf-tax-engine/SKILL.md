---
name: anaf-tax-engine
description: |
  Scoped AI assistance for the D212 tax computation core. Use when fixing
  formulas in computeYearData, the parsers in lib/parsers/, or the rates
  module. Do NOT use for UI restyling, portable build changes, or db schema
  changes (those need explicit human review).
allowed_paths:
  - lib/rates.js
  - lib/parsers/**
  - public/js/app.js
  - test/**
  - docs/d212-mapping.md
  - docs/anaf/**  # read-only — never modify ANAF reference docs
forbidden_paths:
  - public/css/**          # UI styling is out of scope
  - public/index.html      # only allowed when wiring a new computed value into the UI; otherwise out of scope
  - build-portable.js      # portable build packaging
  - setup_paddleocr.js     # Python env setup
  - db.js                  # schema changes require explicit human review
  - server.js              # most changes belong in lib/; allow only when a parser depends on it
  - .github/workflows/**   # CI config changes need human review
  - package.json           # do not add new runtime dependencies
  - package-lock.json
required_checks:
  - npm test
  - npm run check-i18n
  - node --check server.js
---

# anaf-tax-engine — Scoped changes to the D212 tax computation core

You are working on **D212TaxHelper**, a local-first Romanian fiscal tool that computes the Declaratia Unica D212 for investment income.

This skill scopes your changes to the **tax computation engine** (parsers, currency conversion, BNR rates, the `computeYearData` function and its helpers, tests). You **must not** touch UI styling, the portable build pipeline, the database schema, the CI config, or `package.json`. If a task seems to require touching forbidden paths, **stop and ask** before proceeding.

## Single source of truth

- **`lib/rates.js`** — `BNR_EXCHANGE_RATES` (annual averages, 2019-2025), `parseNumber`, `toRON`, `detectCurrency`. Never duplicate these elsewhere; always `require('./lib/rates')`.
- **`docs/anaf/d212-2025/`** — the official ANAF/Ministry of Finance specifications. Treat as read-only. Every claim in code or docs must trace back here.
- **`docs/d212-mapping.md`** — exhaustive D212 → app field mapping with BT-code citations. Update it when you change a formula.
- **`public/js/app.js: computeYearData`** (around line 580-1020) — all tax math flows through here. Read it end-to-end before modifying.

## Three pitfalls discovered the hard way

1. **Regex `\b` does not treat Romanian diacritics as word characters** in JavaScript without the `/u` flag. `\bîn EUR\b` will silently fail to match `"în EUR"`. Use `(?:^|\s)în\s+EUR\b` instead. (Fixed in commit `03e467a` ancestry.)

2. **`Math.max(0, owed - paid)` hides over-withholding scenarios.** When a Romanian broker withholds more tax than what's actually due (e.g. before applying losses), the user is entitled to a refund. Use signed deltas and surface both `refundOwedRON` and `taxDue` separately. (Fixed in commit `65cdcaa` ancestry.)

3. **Losses are "of the same nature" (Cod fiscal art. 119).** Romanian-source capital losses can only offset Romanian-source gains; foreign-source losses only foreign gains. Do not pool them. The single `yd.priorLosses` input is currently treated as RO-only by convention — gap D-5 in ROADMAP.md tracks splitting this properly.

## Concrete workflow for a typical change

1. **Locate the affected formula** in `public/js/app.js: computeYearData` or the relevant parser in `lib/parsers/`.
2. **Cite the source of truth** in code comment: which Cod fiscal article + which paragraph of `docs/anaf/d212-2025/Instructiuni_D212_OMF_2736_2025.pdf` defines the rule.
3. **Add a test** in `test/`. Use synthetic fixtures from `test/fixtures/` (never put real personal data in tests).
4. **Update `docs/d212-mapping.md`** if you change what attributes/BT-codes the app produces.
5. **Run `npm test && npm run check-i18n`** before declaring done.
6. **Manual portable sync**: copy changed files into `../D212TaxHelper-Portable-Full/app/` (until automation lands).

## Forbidden actions

- Do **not** rename exported fields from `computeYearData` without a deprecation alias — they are consumed by UI render functions across the file.
- Do **not** add a new runtime dependency to `package.json`. If a task seems to require one, stop and propose it via issue first.
- Do **not** edit anything under `docs/anaf/d212-2025/` — those are byte-identical copies of ANAF official documents.
- Do **not** modify Tesseract `*.traineddata` files or anything related to PaddleOCR setup.
- Do **not** introduce dependencies between `lib/` and `public/` (lib must stay browser-and-node-safe and DOM-free).

## When to widen the scope

Some changes legitimately straddle the boundary:

- A new income type appears in `lib/parsers/xtb.js` → the UI also needs a new fieldset. You **may** edit `public/index.html` and `public/locales/{ro,en}.json` to wire the new value into the form. **Stop short of styling changes** — open a separate task for those.
- A formula change needs a UI label tweak. Edit the locale files; do not touch the CSS.

In all such cases, prefer **the smallest possible UI change** and call it out explicitly in the commit message.

## House style

- CommonJS modules (`require` / `module.exports`). Match the file's existing style.
- 2-space indentation in JS/JSON. UTF-8 with LF line endings.
- Romanian text in user-facing strings should use proper diacritics (ă, â, î, ș, ț). Code comments may skip them for ASCII compatibility.
- Tests use `node:test` (no Jest, no Mocha). Use `test('name', () => assert.equal(...))`.
- Numbers in D212 XML are integer RON (`Math.round` before output). FX-converted amounts may be float during computation.

## When in doubt, read

- `ROADMAP.md` — the catalog of known gaps with their starter info
- `docs/d212-mapping.md` — the spec mapping
- `docs/anaf/d212-2025/Instructiuni_D212_OMF_2736_2025.pdf` — the official filling instructions

If your change doesn't have a clear answer in those three documents, stop and ask the human.
