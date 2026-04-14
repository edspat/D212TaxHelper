# D212 Asistent Fiscal - Ghid de Utilizare

**Versiune ghid:** 2.1 | **Versiune aplicație:** 3.2.1 | **Ultima actualizare:** 14.04.2026

---

## Cuprins

1. [Introducere](#1-introducere)
2. [Pornirea aplicației](#2-pornirea-aplicației)
3. [Navigare și comenzi](#3-navigare-și-comenzi)
4. [Tab 1 - Panou Principal](#4-tab-1---panou-principal)
5. [Tab 2 - Detalii Venituri](#5-tab-2---detalii-venituri)
6. [Tab 3 - Calcul Impozite](#6-tab-3---calcul-impozite)
7. [Tab 4 - Adaugă Date](#7-tab-4---adaugă-date)
8. [Tab 5 - Importă Document](#8-tab-5---importă-document)
9. [Tab 6 - Date Brute](#9-tab-6---date-brute)
10. [Logica fiscală și reguli](#10-logica-fiscală-și-reguli)
11. [Asistentul D212 — Cum completezi Declarația Unică](#11-asistentul-d212--cum-completezi-declarația-unică)
12. [Administrarea datelor](#12-administrarea-datelor)
13. [Versiunea portabilă](#13-versiunea-portabilă)
14. [Depanare](#14-depanare)
15. [Istoric versiuni aplicație](#15-istoric-versiuni-aplicație)

---

## 1. Introducere

**D212 Asistent Fiscal** este o aplicație web locală destinată rezidenților fiscali din România care primesc venituri din investiții atât de la **brokeri din SUA** (Fidelity, Morgan Stanley) cât și de la **brokeri din România** (XTB) pentru a:

- Importa și parsa documente financiare (PDF-uri și imagini)
- Calcula impozitul pe venit, impozitul pe câștiguri de capital, impozitul pe dividende și CASS (contribuția de asigurări sociale de sănătate)
- Genera valorile necesare completării **Declarației Unice D212** pe portalul ANAF
- Compara datele financiare pe mai mulți ani fiscali

### Pentru cine este această aplicație?

Aplicația este concepută special pentru:
- Angajații Microsoft (sau similari) din România care primesc acțiuni (RSU), acțiuni ESPP și dividende prin Fidelity / Morgan Stanley
- Investitori care și-au transferat acțiunile la un broker din România (ex: XTB)
- Oricine depune D212 pentru venituri din investiții în România

### Funcționalități principale
- **11 parsere de documente** — extrage automat datele din PDF-uri și imagini
- **PaddleOCR** — OCR superior pentru documente scanate (inclusiv tabele Fișă de Portofoliu Tradeville)
- **Bilingv** — interfață completă în Română (RO) și Engleză (EN)
- **Offline și privat** — rulează în totalitate pe calculatorul tău, nicio dată nu este trimisă nicăieri
- **Temă întunecată** — confortabilă pentru ochi, design responsiv
- **Portabil** — poate fi distribuit ca un folder independent (fără instalare)

---

## 2. Pornirea aplicației

### Cerințe
- **Node.js** 18 sau mai recent (recomandat: v22 LTS)
- Un browser modern (Chrome, Edge, Firefox)
- SAU: folosește **versiunea portabilă** (include Node.js, nu necesită instalare)

### Pornirea aplicației

**Opțiunea A — Din sursă:**
```bash
cd D212TaxHelper
npm install          # doar prima dată
node server.js
```

**Opțiunea B — Versiune portabilă:**
Dublu-click pe `Start.bat`. Browserul se deschide automat.

Aplicația rulează la **http://localhost:3000**.

### Oprirea aplicației
- Apasă `Ctrl+C` în terminal, SAU
- Click pe butonul **Repornire Server** din footer (repornește, nu oprește), SAU
- Rulează `Stop.bat` (versiunea portabilă — oprește toate procesele node)

---

## 3. Navigare și comenzi

### Bara de sus (Header)

| Element | Descriere |
|---------|-----------|
| **☰ (Hamburger)** | Afișează/ascunde meniul de navigare pe ecrane mici |
| **Butoane tab-uri** | 6 tab-uri: Panou Principal, Detalii Venituri, Calcul Impozite, Adaugă Date, Importă Document, Date Brute |
| **Selector limbă** | Comută între **RO** (Română) și **EN** (Engleză). Toate etichetele și indicațiile se actualizează instant. |
| **Selector an** | Alege anul fiscal vizualizat/editat. Lista afișează anii care au date, plus anul fiscal implicit (anul precedent). Toate tab-urile se actualizează la schimbarea anului. |

### Bara de jos (Footer)

| Element | Descriere |
|---------|-----------|
| **Versiunea aplicației** (ex: v2.4.0) | Click pentru a vedea istoricul complet de versiuni |
| **Sursa datelor** | Arată de unde provin datele (ANAF, BNR, Fidelity, XTB) |
| **Contact** | Link email către autor |
| **Repornire Server** | Repornește serverul Node.js (pagina se reîncarcă automat) |
| **↑ Sus** | Buton de derulare în sus (apare când derulezi în jos) |

---

## 4. Tab 1 — Panou Principal

Panoul Principal oferă o vedere de ansamblu a situației tale financiare pentru anul selectat.

### Carduri sumar (rândul de sus)

| Card | Descriere |
|------|-----------|
| **Venit Total** | Suma tuturor veniturilor din investiții (dividende + câștiguri capital + dobânzi) în RON |
| **Impozit Total Datorat** | Impozitul total calculat (impozit pe venit + CASS) în RON |
| **Reținere Acțiuni** | Suma deja plătită ca reținere pe beneficii din acțiuni (din fluturaș) |
| **Impozit Net de Plată** | Impozit Total minus Reținere Acțiuni = ce trebuie efectiv plătit prin D212 |

### Grafice (grila de jos)

| Grafic | Descriere |
|--------|-----------|
| **Structura Veniturilor** | Grafic circular cu proporția dividendelor, câștigurilor de capital și dobânzilor |
| **Structura Impozitelor** | Grafic circular cu impozitul pe dividende, câștiguri, dobânzi și CASS |
| **Comparație pe Ani** | Grafic bară comparând veniturile și impozitele pe toți anii cu date |
| **Cursuri de Schimb** | Grafic linie cu evoluția cursului mediu anual USD/RON BNR |

---

## 5. Tab 2 — Detalii Venituri

Acest tab afișează defalcarea detaliată a veniturilor cu toate cifrele din spatele calculelor.

### Tabelul principal de venituri

Fiecare rând reprezintă o categorie de venit:

| Rând | USD | RON | Impozit SUA | Impozit RO |
|------|-----|-----|-------------|------------|
| Dividende SUA | ✓ | ✓ (convertit) | 10% reținut (convenție) | 0% (fără dublă impozitare) |
| Dividende România | - | ✓ | - | 8-16% (reținut de broker) |
| Vânzări acțiuni SUA | ✓ | ✓ (convertit) | - | 10-16% |
| Vânzări acțiuni România ≥1an | - | ✓ | - | 1-3% (final, reținut) |
| Vânzări acțiuni România <1an | - | ✓ | - | 3-6% (final, reținut) |
| Venituri din dobânzi | - | ✓ | - | 10-16% |
| Venituri jocuri noroc | - | ✓ | - | Deja reținut |

### Deduceri Reținere Acțiuni

Afișează intrările individuale de reținere din acțiuni din fluturaș (importate prin documentul **MSFT - Stock Award**). Aceste sume se deduc din impozitul total datorat.

### Vânzări Acțiuni România

Vedere detaliată a tranzacțiilor prin brokerul din România (XTB), defalcate pe:
- **≥1 an** perioadă de deținere (cotă mai mică)
- **<1 an** perioadă de deținere (cotă mai mare)
- **Dividende** primite prin brokerul românesc
- **Dobânzi** câștigate prin brokerul românesc

### Vânzări Acțiuni SUA (Confirmări Tranzacții)

Lista tranzacție cu tranzacție din confirmările brokerului SUA (Fidelity). Afișează data, simbolul, numărul de acțiuni vândute, prețul, încasările, comisioanele și încasările nete.

---

## 6. Tab 3 — Calcul Impozite

Cel mai important tab — arată exact ce datorezi și oferă asistentul de completare D212.

### Sumarul Calculului de Impozite

Împărțit în 3 secțiuni clar etichetate:

#### 💰 Secțiunea A: Ce am câștigat (Venituri brute)
Listează toate categoriile de venituri cu valorile în RON:
- Câștiguri capital SUA, dividende SUA
- Câștiguri capital România (≥1an și <1an), dividende România
- Venituri din dobânzi, venituri jocuri de noroc
- **Total venituri din investiții**

#### ✅ Secțiunea B: Ce s-a plătit deja (Reținut la sursă)
Afișează ce a fost deja colectat:
- Impozit dividende reținut în SUA (10% conform convenției RO-SUA)
- Impozit câștiguri reținut de broker România (impozit final, 1%/3%)
- Impozit dividende reținut de broker România
- Impozit dobânzi reținut
- Rețineri din stock awards
- **Total deja plătit**

#### 📝 Secțiunea C: Ce mai am de plătit (Obligații D212)
Ce rămâne de declarat și plătit:
- Impozit câștiguri capital SUA (10%)
- Impozit dividende SUA (de obicei 0 — convenție)
- Elemente broker România (marcate ca „Impozit final — reținut la sursă, nu se declară")
- Impozit dobânzi rămas
- CASS (contribuție sănătate)
- Deducere rețineri acțiuni
- **⚠ TOTAL DE PLĂTIT PE D212** — acesta este numărul care contează

#### Termen de plată
Afișat la final — termenul de depunere și plată D212 (ex: 25 mai 2026 pentru anul fiscal 2025).

### CASS (Contribuția de Asigurări Sociale de Sănătate)

Defalcarea detaliată a calculului CASS:
- Afișează salariul minim brut și sistemul de paliere
- Evidențiază palierul tău activ
- Arată suma CASS datorată
- Listează tipurile de venituri supuse CASS
- Confirmă că CAS (pensie 25%) NU se aplică pentru venituri din investiții

**Sistemul de paliere CASS (2025):**

| Palier | Interval venituri | Baza CASS | Suma CASS |
|--------|-------------------|-----------|-----------|
| <6 SM | < 24.300 RON | - | 0 |
| 6-12 SM | 24.300 - 48.600 | 24.300 | 2.430 |
| 12-24 SM | 48.600 - 97.200 | 48.600 | 4.860 |
| 24-60 SM | 97.200 - 243.000 | 97.200 | 9.720 |
| >60 SM | > 243.000 | 243.000 | 24.300 |

*SM = salariu minim brut (4.050 RON/lună în 2025)*

### Asistentul D212

Vezi [Secțiunea 11](#11-asistentul-d212--cum-completezi-declarația-unică) pentru instrucțiuni detaliate.

---

## 7. Tab 4 — Adaugă Date

Folosește acest tab pentru a introduce sau suprascrie manual datele financiare pentru anul selectat. Datele introduse aici au prioritate față de datele din documente importate.

### Cardul Venituri și Deduceri

| Câmp | Descriere |
|------|-----------|
| **Dividende SUA (USD)** | Total dividende brute primite de la brokerul SUA (Fidelity / Morgan Stanley) |
| **Dividende România (RON)** | Total dividende primite de la brokerul din România |
| **Vânzări Acțiuni SUA (USD)** | Total încasări brute din vânzarea de acțiuni SUA |
| **Cost achiziție ESPP (USD)** | Costul plătit pentru acțiunile ESPP. Pentru acțiuni gratuite (stock awards), introdu 0. Se deduce din încasări pentru calculul câștigurilor impozabile. |
| **Vânzări Acțiuni România (RON)** | Total încasări din vânzări prin brokerul românesc |
| **Venituri din Dobânzi (RON)** | Total dobânzi primite de la depozite bancare |
| **Reținere Acțiuni Deja Plătită (RON)** | Total rețineri din stock awards deja deduse din salariu (din fluturaș). Această sumă se scade din impozitul final datorat. |

### Cardul Curs de Schimb și Salariu Minim

| Câmp | Descriere |
|------|-----------|
| **Curs USD/RON** | Cursul mediu anual BNR. Pre-completat din datele integrate. |
| **Salariu minim brut (RON/lună)** | Folosit la calculul palierelor CASS. Pre-completat pentru fiecare an. |
| **Termen depunere D212** | Calendar selectabil. Când trebuie depusă D212 și plătite impozitele. |

### Cardul Cote de Impozitare pe Țară

Suprascrie cotele implicite pentru anul selectat:

**Statele Unite (SUA):**
| Cotă | Implicit | Descriere |
|------|----------|-----------|
| Impozit dividende SUA | 10% | Reținut la sursă conform Convenției RO-SUA |
| Impozit câștiguri SUA | 0% | SUA nu impozitează vânzările de acțiuni ale nerezidenților |

**România (RO):**
| Cotă | 2024 | 2025 | 2026+ | Descriere |
|------|------|------|-------|-----------|
| Impozit dividende | 8% | 10% | 16% | Aplicat tuturor dividendelor |
| Câștiguri capital (extern/SUA) | 10% | 10% | 16% | Pentru brokeri non-RO (Fidelity, Morgan Stanley) |
| Câștiguri capital (intern ≥1an) | - | 1% | 3% | Broker România, impozit final |
| Câștiguri capital (intern <1an) | - | 3% | 6% | Broker România, impozit final |
| Impozit dobânzi | 10% | 10% | 16% | Aplicat dobânzilor bancare |

Fiecare secțiune are propriul buton de **Salvare**. Butoanele afișează anul selectat (ex: „Salvează Datele (2025)").

---

## 8. Tab 5 — Importă Document

Încarcă PDF-uri sau imagini pentru a extrage automat datele financiare.

### Cum se importă

1. **Selectează anul** folosind butoanele de alegere an
2. **Selectează tipul documentului** din lista derulantă
3. **Alege unul sau mai multe fișiere** (PDF sau imagine — JPG, PNG, GIF, BMP, TIFF, WebP)
4. Click pe **Încarcă și Procesează**

Datele extrase sunt parsate și salvate automat. Un mesaj de succes/eroare apare.

### Tipuri de documente acceptate

| Tip document | Sursă | Ce extrage |
|--------------|-------|------------|
| **ANAF - Declarație Unică D-212** | Portalul ANAF | Dividende (USD/RON), câștiguri capital, CASS, curs, impozit total |
| **SUA (Fidelity) - Raport Investiții** | Fidelity (PDF anual) | Total dividende, impozite reținute, valoare cont, câștiguri nete |
| **ANAF - Adeverință de Venit** | Angajator (document salarial) | Venituri din dobânzi, impozit dobânzi plătit, venituri și impozit jocuri noroc |
| **MSFT - Document Stock Award** | Fluturaș / portal beneficii | Intrări individuale reținere acțiuni (date + sume în RON) |
| **SUA (Fidelity) - Confirmare Tranzacție** | Fidelity (PDF per tranzacție) | Tranzacții individuale: data, simbol, acțiuni, preț, încasări, comisioane. Suportă **mai multe fișiere** deodată. Deduplicare după număr referință. |
| **România (XTB) - Dividende și Dobânzi** | Cont XTB (RAPORT DIVIDENDE) | Dividende (brut, impozit reținut), dobânzi (brut, impozit reținut) |
| **România (XTB) - Portofoliu** | Cont XTB (FIȘĂ PORTOFOLIU) | Câștiguri pe termen lung și scurt, impozit reținut, defalcare pe țări |
| **SUA (Fidelity) - Extras de Cont** | Fidelity (raport periodic) | Acțiuni vândute, transferuri (către XTB), dividende YTD, totaluri tranzacții |
| **Tax Form - 1042-S** | Formular IRS | Venit brut, impozit federal reținut, cod venit. Pentru dividende (cod 06), are prioritate față de raportul de investiții. |

### Sfaturi
- **Motor OCR:** Aplicația detectează automat PaddleOCR (versiunea Full) sau revine la Tesseract.js (versiunea Lite). Motorul activ este afișat ca insignă în partea de sus a tab-ului Import.
- **Butoane Upgrade / Downgrade:** Lângă insignă, click pe **Upgrade la Full** pentru a instala PaddleOCR (~1,7 GB) sau **Downgrade la Lite** pentru a-l șterge — totul din aplicație, fără repornire.
- **PaddleOCR** oferă rezultate mult mai bune pentru documente scanate, în special tabele complexe precum Fișa de Portofoliu Tradeville.
- **Imaginile** (capturi de ecran, fotografii) sunt procesate cu OCR. Durează câteva secunde.
- Dacă calitatea OCR este prea scăzută, aplicația te va îndruma să introduci datele manual în tab-ul Adaugă Date.
- **Confirmările de tranzacție** suportă încărcarea mai multor fișiere simultan — fiecare fișier este parsat separat și adăugat (cu deduplicare).
- **Formularele 1042-S** sunt deduplicate după identificatorul unic — reîncărcarea aceluiași formular nu creează duplicate.

---

## 9. Tab 6 — Date Brute

Vizualizează, editează sau șterge textul brut extras din documentele importate.

### Controale

| Buton | Descriere |
|-------|-----------|
| **Selectează Fișier** | Alege ce fișier de date brute să vizualizezi (ex: `investment_2025_raw.txt`) |
| **Editare** | Treci în modul editare — conținutul devine editabil |
| **Salvează** | Salvează modificările în fișierul text |
| **Anulează** | Renunță la modificări și revine la modul vizualizare |
| **Șterge** | **Șterge permanent** fișierul text ȘI datele parsate asociate. Necesită confirmare. |

### Ce fișiere sunt stocate

Fiecare document importat creează un fișier text în `data/`:
```
adeverinta_2025_raw.txt
declaratie_2024_raw.txt
investment_2025_raw.txt
fidelity_statement_2025_raw.txt
trade_confirmation_2025_raw.txt
xtb_dividends_2025_raw.txt
xtb_portfolio_2025_raw.txt
form_1042s_2025_raw.txt
```

### Când să folosești Șterge (Purge)
- Dacă ai importat documentul greșit
- Dacă vrei să reimportezi o versiune corectată (șterge mai întâi, apoi reimportează)
- Ștergerea `trade_confirmation_*` șterge și `trades.json`
- Ștergerea `stock_award_*` șterge și `stock_awards.json`

---

## 10. Logica fiscală și reguli

### Dividende SUA (Convenția RO-SUA pentru evitarea dublei impuneri)

Convenția România-SUA prevede:
- **SUA reține 10%** din dividende la sursă
- **România NU mai impozitează** dividendele din SUA (fără dublă impunere)
- Cu toate acestea, dividendele din SUA **SE iau în calcul** la stabilirea plafonului CASS

În practică: nu datorezi impozit suplimentar pe dividendele din SUA, dar venitul este inclus la determinarea palierului CASS.

### Broker România (XTB) — Impozit Final

Când acțiunile sunt vândute prin brokerul din România (XTB):
- Impozitul pe câștiguri de capital este **reținut de broker** (1%/3% pentru 2025, 3%/6% din 2026)
- Impozitul pe dividende este **reținut de broker**
- Acestea sunt **impozite finale** — NU trebuie declarate în D212
- Intră doar la calculul plafonului CASS

### Metode de calcul câștiguri de capital

Sunt 4 scenarii pentru câștigurile de capital din vânzări prin brokerul SUA:

| Scenariu | Formulă |
|----------|---------|
| **ESPP (vesting <1 an)** | Impozabil = [Vânzare − Cumpărare − Comision] × curs − Valoare impozitată ca salariu. Impozit = Impozabil × 10% |
| **ESPP (vesting ≥1 an)** | Impozabil = [Vânzare − Cumpărare − Comision] × curs. Impozit = Impozabil × 10% |
| **Acțiuni gratuite (vesting <1 an)** | Impozabil = [Vânzare − Comision] × curs − Valoare impozitată ca salariu. Impozit = Impozabil × 10% |
| **Acțiuni gratuite (vesting ≥1 an)** | Impozabil = [Vânzare − Comision] × curs. Impozit = Impozabil × 10% |

*„Valoare impozitată ca salariu" = sumele menționate în fluturaș sub „stock withholding", „SPP gain BIK" sau „Stock award BIK".*

### Venituri din dobânzi

- Dobânzile bancare sunt supuse impozitului de 10% (16% din 2026)
- Băncile rețin de obicei acest impozit la sursă
- Suma deja plătită (din adeverința ANAF) se deduce din obligația fiscală

### CASS (Asigurări de Sănătate)

- CASS de 10% se aplică când venitul net total din investiții depășește 6 × salariul minim brut
- Contribuția folosește un sistem de paliere (vezi tabelul din Secțiunea 6)
- CAS (pensie 25%) **NU** se aplică pentru venituri din investiții
- Brokerul din România **NU** reține CASS — trebuie să o declari și plătești singur prin D212

### Evoluția cotelor de impozitare pe ani

| Impozit | 2024 | 2025 | 2026+ |
|---------|------|------|-------|
| Impozit dividende | 8% | 10% | 16% |
| Câștiguri capital (broker SUA) | 10% | 10% | 16% |
| Câștiguri capital (broker RO ≥1an) | - | 1% | 3% |
| Câștiguri capital (broker RO <1an) | - | 3% | 6% |
| Impozit dobânzi | 10% | 10% | 16% |
| CASS (sănătate) | 10% | 10% | 10% |

---

## 11. Asistentul D212 — Cum completezi Declarația Unică

Asistentul D212 (situat în partea de jos a tab-ului **Calcul Impozite**) furnizează valorile exacte pe care să le copiezi în formularul ANAF. Apasă butonul **"🔗 Deschide formularul D212 pe ANAF"** pentru a deschide formularul direct într-o fereastră nouă.

### Pas cu pas: Depunerea D212 pe portalul ANAF

1. Apasă butonul **"🔗 Deschide formularul D212 pe ANAF"** (sau accesează [ANAF D212](https://www.anaf.ro/declaratii/duf)) și autentifică-te
2. Navighează la **Declarații** → **Declarația Unică 212**
3. Creează o declarație nouă pentru anul fiscal afișat

### Capitolul I — Impozit pe Venit și Contribuții Sociale

#### Subsecțiunea I.2.1: Venituri din străinătate (SUA)

Copiază aceste valori din tabelul **Venituri din străinătate** din aplicație:
- Țara sursă: **S.U.A.**
- Curs de schimb: RON/USD (media anuală BNR)
- **CÂȘTIGURI DE CAPITAL:** Valoare vânzare (USD și RON), deducere sume impozitate ca salariu, câștiguri impozabile, impozit datorat
- **DIVIDENDE:** Dividende brut (USD și RON), impozit datorat în România, impozit plătit în SUA (10% credit convenție), diferență de plată (de obicei 0)

#### Venituri România (Doar dobânzi)

Doar **veniturile din dobânzi** de la brokerul din România trebuie declarate. Acțiunile și dividendele de la brokerul din România sunt impozit final (reținut la sursă), marcate ca „Impozit final — reținut la sursă, nu se declară".

#### Subsecțiunea I.3.2: CASS

Copiază:
- Salariu minim, venituri extrasalariale totale, palier CASS, baza de calcul, CASS datorată

#### Secțiunea I.7: Sumar obligații

Copiază sumele sumar:
- Impozit câștiguri capital SUA
- Impozit dividende SUA de plată
- Impozit dobânzi
- Total impozit pe venit
- CASS datorată
- Deducere rețineri acțiuni (dacă există)
- **TOTAL DE PLATĂ** — aceasta este suma pe care trebuie să o plătești până la termen

### Capitolul II — Opțiune plată CASS (Opțional pentru 2025+)

Începând cu D212 pentru anul fiscal 2025, **Capitolul II nu mai este obligatoriu**. Aplicația afișează:
- Dacă CASS nu se datorează (venitul sub 6×SM), confirmă cu ✅
- Dacă vrei voluntar să optezi pentru plata anticipată CASS, sunt afișate baza și suma

---

## 12. Administrarea datelor

### Unde sunt stocate datele

Toate datele sunt stocate local în folderul `data/`:

| Fișier | Conținut |
|--------|----------|
| `parsed_data.json` | Depozit principal: toți anii, venituri, cote, cursuri, documente parsate |
| `trades.json` | Confirmări tranzacții Fidelity (detaliu per tranzacție) |
| `stock_awards.json` | Intrări reținere acțiuni |
| `*_raw.txt` | Text brut extras din documentele importate |
| `pdf_metadata.json` | Metadate despre fișierele PDF sursă (căi, dimensiuni) |

### Backup

Pentru a salva datele, copiază întregul folder `data/`. Pentru restaurare, înlocuiește-l înapoi.

### Resetare

Pentru a începe de la zero:
1. Șterge toate fișierele din folderul `data/`
2. Creează un fișier `parsed_data.json` gol cu conținutul: `{ "years": {} }`
3. Repornește serverul

### Fluxul datelor

```
Încărcare PDF/Imagine
    ↓
Extragere text (pdf-parse sau Tesseract OCR)
    ↓
Text brut salvat (data/*_raw.txt)
    ↓
Parserul extrage date structurate
    ↓
Salvat în parsed_data.json
    ↓
Frontend-ul calculează impozitele și afișează tabele/grafice
```

---

## 13. Versiunea portabilă

Versiunea portabilă este un folder independent care rulează pe orice Windows 10/11 (64-bit) fără a instala nimic.

### Două variante de build

| Variantă | Comandă | Dimensiune | Motor OCR |
|----------|---------|------------|------------|
| **Lite** | `npm run build` | ~174 MB | Doar Tesseract.js |
| **Full** | `npm run build:full` | ~1,9 GB | PaddleOCR + Tesseract.js fallback |

Varianta **Full** include Python Embeddable 3.12 și PaddleOCR pentru OCR superior pe documente scanate (mai ales tabele Fișă de Portofoliu Tradeville).

### Conținut

| Element | Descriere |
|---------|----------|
| `node/` | Runtime Node.js v22 LTS portabil |
| `app/` | Fișierele aplicației (server, frontend, scripturi) |
| `app/python/` | *(doar Full build)* Python 3.12 + PaddleOCR |
| `Start.bat` | Lansează aplicația (deschide browserul automat) |
| `Stop.bat` | Oprește serverul |
| `Upgrade-to-Full.bat` | *(doar Lite build)* Descarcă Python + PaddleOCR pentru upgrade motor OCR |
| `Downgrade-to-Lite.bat` | Șterge folderul Python/PaddleOCR pentru a elibera spațiu pe disc |
| `README.md` | Instrucțiuni de pornire rapidă |

### Upgrade de la Lite la Full

Poți face upgrade în două moduri:

**Opțiunea A — Din aplicație (recomandat):**
1. Deschide tab-ul **Importă Document**
2. Click pe butonul **Upgrade la Full** de lângă insigna OCR
3. Confirmă când ești întrebat (descarcă ~1,7 GB)
4. Așteaptă finalizarea instalării — insigna va deveni verde automat

**Opțiunea B — Cu fișierul batch:**
1. Dublu-click pe **Upgrade-to-Full.bat**
2. Confirmă când ești întrebat
3. Repornește aplicația

### Downgrade de la Full la Lite

Pentru a elibera spațiu pe disc (~1 GB+):

**Opțiunea A — Din aplicație:**
1. Deschide tab-ul **Importă Document**
2. Click pe butonul **Downgrade la Lite**
3. Confirmă — folderul python/ este șters și insigna trece pe galben

**Opțiunea B — Cu fișierul batch:**
1. Dublu-click pe **Downgrade-to-Lite.bat**
2. Repornește aplicația

Datele tale sunt păstrate în ambele cazuri. Poți comuta între variante oricând.

### Construirea versiunii portabile

Din proiectul sursă:
```bash
npm run build          # Build Lite (doar Tesseract)
npm run build:full     # Build Full (PaddleOCR + Tesseract)
```

Versiunea portabilă:
- Descarcă Node.js v22 LTS automat
- Copiază toate fișierele aplicației (fără date personale)
- Instalează dependențele de producție
- *(Full build)* Descarcă Python Embeddable 3.12 și instalează PaddleOCR
- Creează scripturile de lansare

### Note importante
- Versiunea portabilă pornește cu un **folder de date gol** — nicio dată financiară personală nu este inclusă
- Datele tale sunt stocate în `app/data/` din folderul portabil — salvează acest folder

---

## 14. Depanare

### Aplicația nu pornește

| Problemă | Soluție |
|----------|---------|
| Portul 3000 ocupat | Setează alt port: `PORT=3001 node server.js` |
| Node.js negăsit | Instalează Node.js 18+ de la https://nodejs.org/ |
| Dependențe lipsă | Rulează `npm install` în folderul D212TaxHelper |

### Erori la import

| Problemă | Soluție |
|----------|---------|
| „Calitate OCR prea scăzută” | Folosește varianta Full cu PaddleOCR, sau încarcă versiunea PDF text (nu o versiune scanată/fotografie) |
| Imaginea durează prea mult | Procesarea OCR consumă CPU. Așteaptă 10-30 secunde. PaddleOCR este mai rapid decât Tesseract pentru majoritatea documentelor. |
| Date extrase greșit | Verifică în tab-ul Date Brute, editează dacă e nevoie, sau șterge și reimportează |
| Tranzacții duplicate | Confirmările de tranzacție sunt deduplicate după numărul de referință — duplicatele sunt ignorate automat |

### Probleme cu datele

| Problemă | Soluție |
|----------|---------|
| Date de anul greșit | Verifică selectorul de an din header — toate tab-urile folosesc acest an |
| Datele manuale nu se salvează | Asigură-te că apeși butonul de Salvare corect (sunt 3 formulare separate) |
| Cifrele par greșite | Verifică cursul de schimb în Adaugă Date — cursul afectează toate conversiile USD→RON |
| Se afișează date vechi | Încearcă butonul Repornire Server din footer |

### Probleme cu serverul

| Problemă | Soluție |
|----------|---------|
| Pagina nu se încarcă | Verifică dacă serverul rulează (terminalul trebuie să arate mesajul „Server running") |
| Serverul se oprește | Verifică folderul `logs/` pentru detalii erori. Repornește cu `node server.js` |
| Stop.bat oprește prea mult | `Stop.bat` folosește `taskkill /f /im node.exe` care oprește TOATE procesele Node.js de pe calculator |

---

## 15. Istoric versiuni aplicație

Vezi istoricul complet făcând click pe numărul versiunii din footer-ul aplicației, sau consultă:
- [CHANGELOG.en.md](CHANGELOG.en.md) (Engleză)
- [CHANGELOG.ro.md](CHANGELOG.ro.md) (Română)

### Versiunea curentă: v3.2.1 (14.04.2026)

**Modificări majore:**
- Tooltip-uri detaliate pe toate rândurile de venituri (rețineri, credite, deduceri)
- Input manual impozit dobânzi plătit
- Grafice ascunse fără date
- Notă de subsol cu exemplu deducere 40% pe chirii/drepturi IP
- 4 tipuri noi de venituri, corecturi conformitate ANAF, refacere panou principal

### Versiunea anterioară: v3.2.0 (14.04.2026)

4 tipuri noi de venituri (chirii, drepturi IP, jocuri noroc, alte surse), câmpuri impozit dividende SUA/RO, cote corectate 2019-2022, conformitate CASS, 5 căsuțe panou, grafic salariu minim, pornire asincronă.

---

*D212 Asistent Fiscal © 2026 | Contact: edmund.spatariu@microsoft.com*
