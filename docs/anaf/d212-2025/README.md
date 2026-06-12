# ANAF reference documents — D212 / fiscal year 2025

This folder contains the **official ANAF specifications** that the app uses as ground truth for D212 calculations and validations. Everything in this folder is **publicly published** by Agenția Națională de Administrare Fiscală (ANAF) and the Ministry of Finance (MF).

Used by:

- `lib/parsers/xtb.js` — schema-aware extraction of XTB reports (no direct dependency, but field-naming follows the schema)
- `lib/rates.js` — BNR rate values cross-checked against the periods covered by these documents
- `server.js: extractAnafD212Xml` — parses XFA-embedded XML from D212 PDFs using the `cap14`, `cap11`, `oblig_realizat`, `cass18` element names defined here
- `docs/d212-mapping.md` — the line-by-line mapping cites every BT-code defined in `D212.xsd`
- `scripts/parse-d212-xsd.js` — extracts structured field metadata from `D212.xsd`

## Inventory

| File | Version | Date | Purpose |
|---|---|---|---|
| **`D212.xsd`** | v1.0.4 | 24.11.2025 | XML Schema — defines every element and attribute of a D212 declaration |
| **`D212.sch`** | — | — | Schematron orchestrator that includes the four business rule files |
| **`business/d212-business.sch`** | — | — | Validation rules **BR-D212-0001 … 0016 + 0076** (header, contributor, options) |
| **`business/d212-business-2.sch`** | — | — | Validation rules **BR-D212-0017 … 0029** |
| **`business/d212-business-3.sch`** | — | — | Validation rules **BR-D212-0030 … onwards** |
| **`business/d212-business-4.sch`** | — | — | Final block of validation rules |
| **`codes/d212-codes.sch`** | v1.0.0 | 23.12.2025 | Income category codes whitelist (Nomenclator_venituri_STR for cap14, Nomenclator_venituri_RO for cap11) |
| **`syntax/d212-syntax.sch`** | — | — | XML syntax validation rules |
| **`nomenclator_caen.xml`** | — | — | CAEN codes nomenclator (used by `cap11.caen`) |
| **`structura_D212_v1.0.8_17042026.pdf`** | v1.0.8 | 17.04.2026 | Human-readable technical structure document |
| **`d212_docTehnica_v1.0.8_17042026.xls`** | v1.0.8 | 17.04.2026 | Machine-readable technical structure (includes the labels for the 19 income category codes) |
| **`Instructiuni_D212_OMF_2736_2025.pdf`** | OMF 2736/2025 | 2025 | Official Ministerial Order — the filling instructions (the "manual" that explains every Rd. line: what to enter, formulas, exceptions) |
| **`readme-anaf.txt`** | — | — | The original ANAF readme that shipped with the technical documentation bundle (renamed from `readme.txt` to avoid colliding with the folder README) |

## Provenance

These files are not redistributed under a separate license — they are official Romanian government technical documents published for public use under the official transparency framework. Originals are downloadable from:

- **XSD + Schematron + nomenclatoare:** https://static.anaf.ro/static/10/Anaf/Declaratii_R/ (look for the D212 documentation bundle; the exact URL changes when ANAF reorganizes)
- **Filling instructions (OMF 2736/2025):** Published in *Monitorul Oficial* and mirrored on https://static.anaf.ro/static/10/Anaf/legislatie/ — search for "Instructiuni D212 2025"

Our copies were sourced from those static.anaf.ro distributions and are byte-identical with what ANAF publishes. We keep them in the repo so contributors can:

1. **Verify** that any mapping in `docs/d212-mapping.md` (or any logic in the codebase) cites a real attribute / paragraph that exists in the official spec.
2. **Diff** against new ANAF releases — when ANAF ships v1.0.5 of the XSD or revises the instructions, we can `git diff` to spot which fields changed and update parsers / formulas accordingly.
3. **Defend** declarations made by users of the app under an ANAF audit — every computation has a clear paper trail back to a named paragraph in an official document.

## Versioning policy

When ANAF publishes a new schema version or new instructions:

1. Create a new folder `docs/anaf/d212-<new-fiscal-year>/` (or, if the change is mid-year for the same fiscal year, `docs/anaf/d212-<year>-rev<N>/`).
2. Copy the **new** documents into the new folder. Do **not** edit files in old folders — they are historical records.
3. Update the table above with the new versions and dates.
4. Run `node scripts/parse-d212-xsd.js docs/anaf/<new-folder>/D212.xsd > /tmp/new.json` and diff against the previous output to spot schema changes.
5. Update `docs/d212-mapping.md` if attributes were added/removed/renamed.
6. Update any parsers (`lib/parsers/*.js`) if the format of attached PDFs changes.
7. Run `npm test` and `npm run check-i18n`.

## File integrity

These documents should not be modified after they are committed. If a file appears corrupted, replace it from the official ANAF source — do not patch it locally. The byte-level fidelity is what makes the audit trail meaningful.
