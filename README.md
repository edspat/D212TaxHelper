> **[English version](README.en.md)**

# D212 Asistent Fiscal

[![CI](https://github.com/edspat/D212TaxHelper/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/edspat/D212TaxHelper/actions/workflows/ci.yml)

O aplicație web locală care ajută rezidenții fiscali din România să calculeze și să pregătească **Declarația Unică D212** pentru veniturile din investiții de la brokeri din SUA și România.

## Pentru cine este?

- Angajații companiilor din USA cu puncte de lucru în România care primesc acțiuni (RSU), acțiuni ESPP și dividende prin **Fidelity / Morgan Stanley**
- Investitorii care tranzacționează sau dețin acțiuni prin brokeri români **XTB**, **BT Capital Partners (bt-trade.ro)** sau **Tradeville** și/sau brokerul străin **Revolut** (pentru alți brokeri, [contactează-mă](https://github.com/edspat))
- PFA (activități independente) care depun D212 alături de venituri din investiții
- Oricine depune D212 pentru venituri din investiții în România

## Funcționalități

- **Parsare a 13+ tipuri de documente** — Fidelity (raport anual, extras, confirmări tranzacție), Morgan Stanley Stock Plan, formulare 1042-S (cu suport pentru PDF-uri multi-formular), XTB (dividende + portofoliu), Tradeville, BT Capital Partners, Revolut (consolidated statement), adeverințe ANAF, declarații D-212, DUF XML pre-completat
- **Calculul impozitelor** — impozit pe venit, câștiguri de capital, dividende, dobânzi, CASS investiții și CASS PFA, plus impozit pe venit PFA (art. 64-67)
- **Navigare grupată în 5 tab-uri** — Panou Principal · 📥 Date (Adaugă/Editează + Importă) · 📊 Calcul (Detalii Venituri + Impozit & CASS) · 🧾 Depunere (Validează & Pregătește D212 + Ghid Depunere) · ⚙ Avansat (Date Brute + Reguli & Referințe)
- **🔬 Validează & Pregătește D212** — import DUF XML, diff side-by-side ANAF vs. local, selector ANAF/Local per rând, cross-check D205 per plătitor (matcher exact / aproape / posibil / doar ANAF / doar local)
- **🧾 Ghid Depunere D212** — parcurgere oficială a fluxului DUF cu capturi anonimizate și tabel de mapare DUF
- **📤 Export D212 XML** — emite XML aliniat cu structura DUF (cap11Rows pentru câștiguri RO, cap14 pentru dividende străine per țară, oblig_realizat cu blocul CASS investiții)
- **📦 ANAF Audit Pack** — ZIP determinist (CRC + timestamp-uri stabile) cu tot ce trebuie pentru un audit: fișiere brute, JSON parsate, intrări D205, XML D212, trace de reguli
- **⚖️ Reguli & Referințe** — pagină căutabilă pentru contabili, fiecare regulă citează articolul din Cod fiscal + paragraful din Instr. D212
- **Insigne de sursă + detector de conflicte** pe tab-ul Calcul — fiecare cifră arată de unde a venit; conflictele între DUF și documentele locale ridică un avertisment
- **Suport multi-valută** — RON / EUR / USD prin broker român (XTB, BT) cu cursuri BNR EUR/RON și USD/RON 2019-2025
- **Suport PFA** — venit net, CASS independent de investiții cu scara 6/12/24 SM, opt-in art. 180(2)
- **Pierderi fiscale reportate** — compensare pierderi din anii precedenți conform D212 Rd.5-6 (max 70%, reportare 7 ani)
- **6 grafice interactive** — structura veniturilor, structura impozitelor, comparație pe ani, total impozite, cursuri de schimb și salariu minim
- **Bilingv** — interfață completă în Română și Engleză
- **Offline și privat** — rulează în totalitate pe calculatorul tău, nicio dată nu este trimisă nicăieri
- **Temă luminoasă/întunecată/auto** — urmează preferința sistemului sau comutare manuală; accesibilitate WCAG 2.1 AA verificată
- **Verificare automată actualizări** — verifică pe GitHub la pornire dacă există versiuni noi; descarcă, instalează și repornește direct din aplicație, păstrând toate datele
- **Versiune portabilă** — folder independent cu Node.js inclus (fără instalare)

## Pornire rapidă

### Cerințe

- [Node.js](https://nodejs.org/) 18+ (recomandat: v22 LTS) | Obligatoriu pentru opțiunile A și C. **Opțiunea B** => **Just run it** (e portabilă)
- Un browser modern (Edge, Chrome, Firefox)
- Windows

### Opțiunea A — Git Clone

```bash
git clone https://github.com/edspat/D212TaxHelper.git
cd D212TaxHelper
npm install
npm start
```

### Opțiunea B — Descărcare manuală (fără Git)

1. Mergi la [ultima versiune](https://github.com/edspat/D212TaxHelper/releases/latest)
2. Descarcă `D212TaxHelper-Portable-v*.zip`
3. Extrage arhiva ZIP într-un folder oarecare
4. Opțional: redenumește-l `D212TaxHelper-Portable`
5. Dublu-click pe `Start.bat` — browserul se deschide automat

Atât — versiunea portabilă include Node.js, nu necesită instalare.

### Opțiunea C — Sursă ZIP (necesită Node.js)

1. Click pe butonul verde **Code** de pe [pagina repository-ului](https://github.com/edspat/D212TaxHelper) → **Download ZIP**
2. Extrage arhiva ZIP într-un folder oarecare
3. Deschide un terminal în folderul extras și rulează:

```bash
npm install
npm start
```

Deschide http://localhost:3000 în browser.

### Comenzi rapide Windows

- **Start.bat** — pornește serverul și deschide browserul
- **Stop.bat** — oprește serverul

## Versiunea portabilă

Două variante complet independente (includ Node.js) care nu necesită instalare:

| Variantă | Comandă | Dimensiune | Motor OCR |
|----------|---------|------------|-----------|
| **Lite** | `npm run build` | ~174 MB | Doar Tesseract.js |
| **Full** | `npm run build:full` | ~1,0 GB | PaddleOCR + Tesseract.js |

Rezultatul este creat lângă folderul sursă. Dublu-click pe `Start.bat` pentru a rula.

Varianta **Full** include PaddleOCR pentru extragere superioară de text din documente scanate (mai ales tabelele Fișă de Portofoliu Tradeville pe care Tesseract nu le poate citi).

Poți comuta între Lite și Full oricând — fie din tab-ul **Importă Document** (butoanele Upgrade la Full / Downgrade la Lite), fie cu `Upgrade-to-Full.bat` / `Downgrade-to-Lite.bat`.

## Documente acceptate

Dropdown-ul de tip document este grupat în 6 optgroups (Fidelity / Morgan Stanley / XTB / BT / Revolut / ANAF), iar tab-ul Importă afișează panoul „Documente deja importate” cu butoane de ștergere per document.

| Document | Sursă |
|----------|-------|
| Raport anual investiții | Fidelity |
| Extras de cont Fidelity | Fidelity |
| Confirmare tranzacție | Fidelity |
| Extras Stock Plan | Morgan Stanley |
| Formular 1042-S (multi-form) | IRS / Fidelity |
| Adeverință venit | Angajator |
| Calcul declarație unică | Consultant fiscal |
| Raport dividende | XTB |
| Raport portofoliu | XTB |
| Fișă de Portofoliu | Tradeville |
| Raport tranzacții / dividende | BT Capital Partners (bt-trade.ro) |
| Consolidated statement | Revolut Securities Europe |
| DUF XML pre-completat | ANAF (Preluare/modificare date) |
| Imagini (OCR) | Orice (via PaddleOCR / Tesseract.js) |

## Structura proiectului

```
D212TaxHelper/
├── server.js            # Server Express și rute API
├── db.js                # Strat bază de date SQLite
├── ledger.js            # Motor FIFO cost de achiziție
├── ocr_service.py       # Subprocess PaddleOCR (Python)
├── setup_paddleocr.js   # Script instalare PaddleOCR
├── lib/                 # Module logică fiscală (testabile separat)
│   ├── rates.js                 # Cursuri BNR, parseNumber, toRON, detectCurrency
│   ├── source-resolver.js       # Înglțiuți care știe de unde provine fiecare valoare
│   ├── income-resolvers.js      # Resolveri per categorie (dividende, dobânzi, câștiguri…)
│   ├── rules-catalog.js         # Reguli citate cu Cod fiscal + Instr. D212
│   ├── d205-categories.js       # Catalog categorii D205
│   ├── d205-matcher.js          # Cross-check D205 ANAF vs. local
│   ├── d212-cap11.js            # Capitol I.1 (câștiguri capital RO, Rd.1-Rd.8)
│   ├── d212-cap14.js            # Capitol I.4 (dividende străine per țară, credit fiscal)
│   ├── d212-oblig-realizat.js   # Bloc <oblig_realizat> + CASS investiții
│   ├── d212-personal.js         # Date personale (CNP, adresă, IBAN)
│   ├── d212-xml-builder.js      # Emitere XML D212 aliniat cu DUF
│   ├── d212-xml-parser.js       # Import DUF XML pre-completat
│   ├── d212-duf-compare.js      # Diff ANAF DUF vs. valori locale
│   ├── audit-pack-builder.js    # Construire ZIP audit ANAF (determinist)
│   ├── minizip.js               # Implementare ZIP pure-JS (zero dependențe)
│   └── parsers/                 # Parsere per broker (xtb, bt, revolut…)
├── public/              # Frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── app.js       # Logica principală a aplicației (5 tab-uri × sub-tab-uri)
│   │   ├── charts.js    # Randare grafice
│   │   └── i18n.js      # Internaționalizare
│   ├── assets/screenshots/  # Capturi anonimizate pentru ghidul DUF
│   └── locales/         # Traduceri EN/RO
├── scripts/             # Scripturi utilitare
│   └── check-i18n.js    # Verificare completitudine traduceri
├── test/                # Suită de teste (node:test, zero dep)
├── data/                # Date financiare parsate (gitignored)
├── uploads/             # PDF-uri încărcate (gitignored)
├── build-portable.js    # Constructor versiune portabilă (--full pentru PaddleOCR)
├── GUIDE.en.md          # Ghid utilizare (Engleză)
├── GUIDE.ro.md          # Ghid utilizare (Română)
├── CHANGELOG.en.md      # Istoric versiuni (Engleză)
└── CHANGELOG.ro.md      # Istoric versiuni (Română)
```

## Stack tehnologic

- **Backend:** Node.js, Express 5, compression
- **Bază de date:** SQLite (better-sqlite3)
- **Frontend:** Vanilla JS, HTML, CSS
- **Parsare PDF:** pdf-parse-new
- **OCR (primar):** PaddleOCR 3.x via subprocess Python (PP-StructureV3)
- **OCR (fallback):** Tesseract.js 7
- **Python:** Embeddable 3.12 (opțional, pentru build Full PaddleOCR)

## Confidențialitate

Toate datele rămân pe calculatorul tău. Aplicația rulează un server local pe `localhost:3000` fără apeluri de rețea externe. Documentele financiare și datele parsate nu sunt trimise nicăieri.

## Contribuții & Roadmap

- 📋 [ROADMAP.md](ROADMAP.md) — lista cu ce urmează (gap-uri D212 + îmbunătățiri platformă), priorități și cum poți contribui
- 📖 [docs/d212-mapping.md](docs/d212-mapping.md) — mapare exhaustivă D212 → app, cu citații la XSD-ul ANAF și la instrucțiunile oficiale (OMF 2736/2025)
- 📚 [docs/anaf/d212-2025/](docs/anaf/d212-2025/) — documentele oficiale ANAF (XSD, schematron, instrucțiuni) păstrate în repo ca sursă de adevăr versionată

Contabilii care găsesc reguli pe care le ratăm sunt rugați să deschidă un issue cu titlul `[Roadmap proposal] <descriere>` și să cite paragraful din Cod fiscal / instrucțiunile D212 care fundamentează regula.

## Licență

Această lucrare este licențiată sub [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Poți distribui și adapta pentru scopuri necomerciale cu atribuire.
