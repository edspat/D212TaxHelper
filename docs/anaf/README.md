# ANAF reference documents

This tree mirrors the official ANAF / Ministry of Finance specifications that the app relies on as ground truth for D212 calculations.

```
docs/anaf/
├── README.md                ← this file
└── d212-2025/               ← fiscal year 2025 (declared in 2026)
    ├── README.md            ← inventory + provenance + how to update
    ├── D212.xsd             ← XML schema (v1.0.4, 24.11.2025)
    ├── D212.sch             ← schematron orchestrator
    ├── business/*.sch       ← 4 files, BR-D212-* validation rules
    ├── codes/*.sch          ← category code whitelist
    ├── syntax/*.sch         ← XML syntax rules
    ├── nomenclator_caen.xml ← CAEN nomenclator
    ├── structura_D212_*.pdf ← human-readable structure doc
    ├── d212_docTehnica_*.xls← machine-readable structure doc
    ├── Instructiuni_*.pdf   ← official filling instructions (OMF 2736/2025)
    └── readme-anaf.txt      ← original ANAF readme from the bundle
```

## When a new fiscal year arrives

ANAF typically publishes the new D212 specification at the end of the year preceding the filing deadline. When that happens:

1. Create `docs/anaf/d212-<new-year>/` and copy the new ANAF bundle there
2. Add a per-folder `README.md` (use the existing one as a template, update the inventory table)
3. Diff the new XSD against the previous to find changed/added/removed fields
4. Update `docs/d212-mapping.md` accordingly
5. Update parsers in `lib/parsers/*.js` if XTB/Tradeville/BT changed their report layout
6. Run `npm test` and `npm run check-i18n`

Old folders stay as historical records — never edit them.

## Why this lives in the repo

- **Reproducibility:** every claim in `docs/d212-mapping.md` cites a specific paragraph or BT-code in these documents
- **Audit trail:** users facing an ANAF inquiry can point to the exact version of the spec their declaration was prepared against
- **Version diff:** when ANAF revises the schema or instructions, the diff is visible in `git log` rather than buried in someone's email archive
- **Offline-first principle:** the app already runs fully offline; including its source-of-truth specs keeps it self-contained

These are public Romanian government documents and are not redistributed under a separate license. See `d212-2025/README.md` for original ANAF source URLs.
