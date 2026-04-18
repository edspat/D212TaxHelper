> **[English version](README.en.md)**

# D212 Asistent Fiscal

O aplicație web locală care ajută rezidenții fiscali din România să calculeze și să pregătească **Declarația Unică D212** pentru veniturile din investiții de la brokeri din SUA și România.

## Pentru cine este?

- Angajații companiilor din USA cu puncte de lucru în România care primesc acțiuni (RSU), acțiuni ESPP și dividende prin **Fidelity / Morgan Stanley**
- Investitorii care tranzacționează sau dețin acțiuni prin **XTB** sau **Tradeville** (singurii brokeri din România suportați deocamdată — pentru alți brokeri, [contactează-mă](https://github.com/edspat))
- Oricine depune D212 pentru venituri din investiții în România

## Funcționalități

- **11 parsere de documente** — extrage automat datele din PDF-uri și imagini (extrase Fidelity, extrase Morgan Stanley, formulare 1042-S, rapoarte XTB, portofoliu Tradeville, confirmări de tranzacție, declarații ANAF D-212 etc.)
- **Calculul impozitelor** — impozit pe venit, impozit pe câștiguri de capital, impozit pe dividende și CASS (contribuția de asigurări sociale de sănătate)
- **Asistent completare D212** — generează valorile exacte necesare completării declarației ANAF
- **6 grafice interactive** — structura veniturilor, structura impozitelor, comparație pe ani, total impozite, cursuri de schimb și salariu minim — cu săgeți de navigare pentru 6+ ani
- **Comparație multi-an** — compară datele financiare pe mai mulți ani fiscali
- **Bilingv** — interfață completă în Română și Engleză
- **Offline și privat** — rulează în totalitate pe calculatorul tău, nicio dată nu este trimisă nicăieri
- **Temă luminoasă/întunecată/auto** — urmează preferința sistemului sau comutare manuală; accesibilitate WCAG 2.1 AA verificată
- **Pierderi fiscale reportate** — compensare pierderi din anii precedenți conform D212 Rd.5-6 (max 70%, reportare 7 ani)
- **Verificare automată actualizări** — verifică pe GitHub la pornire dacă există versiuni noi; descarcă, instalează și repornește direct din aplicație, păstrând toate datele
- **Versiune portabilă** — folder independent cu Node.js inclus (fără instalare)

## Pornire rapidă

### Cerințe

- [Node.js](https://nodejs.org/) 18+ (recomandat: v22 LTS)
- Un browser modern (Chrome, Edge, Firefox)

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
4. Dublu-click pe `Start.bat` — browserul se deschide automat

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
| **Full** | `npm run build:full` | ~1,9 GB | PaddleOCR + Tesseract.js |

Rezultatul este creat lângă folderul sursă. Dublu-click pe `Start.bat` pentru a rula.

Varianta **Full** include PaddleOCR pentru extragere superioară de text din documente scanate (mai ales tabelele Fișă de Portofoliu Tradeville pe care Tesseract nu le poate citi).

Poți comuta între Lite și Full oricând — fie din tab-ul **Importă Document** (butoanele Upgrade la Full / Downgrade la Lite), fie cu `Upgrade-to-Full.bat` / `Downgrade-to-Lite.bat`.

## Documente acceptate

| Document | Sursă |
|----------|-------|
| Raport anual investiții | Fidelity |
| Extras de cont Fidelity | Fidelity |
| Confirmare tranzacție | Fidelity |
| Extras Stock Plan | Morgan Stanley |
| Formular 1042-S | Fidelity |
| Adeverință venit | Angajator |
| Calcul declarație unică | Consultant fiscal |
| Raport dividende | XTB |
| Raport portofoliu | XTB |
| Fișă de Portofoliu | Tradeville |
| Imagini (OCR) | Orice (via PaddleOCR / Tesseract.js) |

## Structura proiectului

```
D212TaxHelper/
├── server.js            # Server Express și rute API
├── db.js                # Strat bază de date SQLite
├── ledger.js            # Motor FIFO cost de achiziție
├── ocr_service.py       # Subprocess PaddleOCR (Python)
├── setup_paddleocr.js   # Script instalare PaddleOCR
├── public/              # Frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── app.js       # Logica principală a aplicației
│   │   ├── charts.js    # Randare grafice
│   │   └── i18n.js      # Internaționalizare
│   └── locales/         # Traduceri EN/RO
├── scripts/             # Scripturi utilitare
│   └── check-i18n.js    # Verificare completitudine traduceri
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

## Licență

Această lucrare este licențiată sub [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Poți distribui și adapta pentru scopuri necomerciale cu atribuire.
