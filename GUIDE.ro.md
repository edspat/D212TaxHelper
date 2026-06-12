# D212 Asistent Fiscal - Ghid de Utilizare

**Versiune ghid:** 3.0 | **Versiune aplicație:** 1.6.0 | **Ultima actualizare:** 12.06.2026

---

## Cuprins

1. [Introducere](#1-introducere)
2. [Pornirea aplicației](#2-pornirea-aplicației)
3. [Navigare și comenzi](#3-navigare-și-comenzi)
4. [Tab 1 - Panou Principal](#4-tab-1---panou-principal)
5. [Tab 2 - 📥 Date (Adaugă/Editează + Importă)](#5-tab-2----date-adaugăeditează--importă)
6. [Tab 3 - 📊 Calcul (Detalii Venituri + Impozit & CASS)](#6-tab-3----calcul-detalii-venituri--impozit--cass)
7. [Tab 4 - 🧾 Depunere (Validează & Pregătește + Ghid Depunere)](#7-tab-4----depunere-validează--pregătește--ghid-depunere)
8. [Tab 5 - ⚙ Avansat (Date Brute + Reguli & Referințe)](#8-tab-5----avansat-date-brute--reguli--referințe)
9. [Logica fiscală și reguli](#9-logica-fiscală-și-reguli)
10. [Suport PFA (activități independente)](#10-suport-pfa-activități-independente)
11. [Suport multi-valută (RON / EUR / USD)](#11-suport-multi-valută-ron--eur--usd)
12. [ANAF Audit Pack (export ZIP determinist)](#12-anaf-audit-pack-export-zip-determinist)
13. [Administrarea datelor](#13-administrarea-datelor)
14. [Versiunea portabilă](#14-versiunea-portabilă)
15. [Depanare](#15-depanare)
16. [Istoric versiuni aplicație](#16-istoric-versiuni-aplicație)

---

## 1. Introducere

**D212 Asistent Fiscal** este o aplicație web locală destinată rezidenților fiscali din România care primesc venituri din investiții atât de la **brokeri din SUA** (Fidelity, Morgan Stanley) cât și de la **brokeri din România** (XTB, BT Capital Partners, Tradeville) sau de la **brokeri străini** (Revolut) pentru a:

- Importa și parsa documente financiare (PDF-uri, imagini, DUF XML pre-completat de la ANAF)
- Calcula impozitul pe venit, câștigurile de capital, dividende, dobânzi și CASS (sistemul de paliere)
- Genera valorile (și fișierul XML) necesare completării **Declarației Unice D212** pe portalul ANAF
- Valida valorile completate de ANAF (DUF) împotriva propriilor documente și a sumelor D205 raportate de plătitori
- Compara datele financiare pe mai mulți ani fiscali

### Pentru cine este această aplicație?

Aplicația este concepută special pentru:
- Angajații companiilor din USA cu puncte de lucru în România care primesc acțiuni (RSU), acțiuni ESPP și dividende prin Fidelity / Morgan Stanley
- Investitori care tranzacționează prin brokeri români (**XTB**, **BT Capital Partners**, **Tradeville**) sau prin brokerul străin **Revolut**
- PFA (activități independente) care depun D212 alături de venituri din investiții
- Oricine depune D212 pentru venituri din investiții în România

### Funcționalități principale
- **13+ parsere de documente** — Fidelity (anual, extras, confirmări), Morgan Stanley Stock Plan, 1042-S (multi-formular), XTB (dividende + portofoliu), Tradeville, BT Capital Partners, Revolut, adeverințe ANAF, D-212, DUF XML
- **Navigare grupată în 5 tab-uri** — Panou Principal · 📥 Date · 📊 Calcul · 🧾 Depunere · ⚙ Avansat
- **Validează & Pregătește D212** — import DUF XML, diff side-by-side ANAF vs. local, cross-check D205 per plătitor
- **Export D212 XML** — fișier XML aliniat cu structura DUF (Cap I.1 + Cap I.4 + `<oblig_realizat>` + CASS)
- **Ghid Depunere D212** — parcurgere oficială a fluxului DUF cu capturi anonimizate și tabel de mapare DUF
- **Reguli & Referințe** — pagină căutabilă pentru contabili (Cod fiscal + Instr. D212)
- **ANAF Audit Pack** — ZIP determinist cu tot ce trebuie pentru un audit
- **Insigne de sursă + detector de conflicte** pe tab-ul Calcul
- **Suport multi-valută** (RON / EUR / USD) prin brokeri români (XTB, BT) cu cursuri BNR 2019-2025
- **Suport PFA** — venit net, scara CASS 6/12/24 SM, opt-in art. 180(2)
- **PaddleOCR** — OCR superior pentru documente scanate (varianta Full)
- **Bilingv** — interfață completă în Română (RO) și Engleză (EN)
- **Offline și privat** — rulează în totalitate pe calculatorul tău, nicio dată nu este trimisă nicăieri
- **Temă întunecată/luminoasă/auto** — confortabilă pentru ochi, design responsiv, WCAG 2.1 AA
- **Portabil** — poate fi distribuit ca un folder independent (fără instalare)

---

## 2. Pornirea aplicației

### Cerințe
- **Node.js** 18 sau mai recent (recomandat: v22 LTS)
- Un browser modern (Chrome, Edge, Firefox)
- SAU: folosește **versiunea portabilă** (include Node.js, nu necesită instalare)

### Pornirea aplicației

**Opțiunea A — Versiune portabilă (recomandat):**
1. Descarcă ultimul `D212TaxHelper-Portable-v*.zip` de pe [Releases](https://github.com/edspat/D212TaxHelper/releases/latest)
2. Extrage arhiva ZIP într-un folder oarecare
3. Dublu-click pe `Start.bat`. Browserul se deschide automat.

**Opțiunea B — Din sursă (necesită Node.js):**
```bash
cd D212TaxHelper
npm install          # doar prima dată
node server.js
```

**Opțiunea C — Versiune portabilă (deja instalată):**
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
| **Butoane tab-uri (5 grupuri)** | **Panou Principal** · **📥 Date** (sub-tab-uri: Adaugă/Editează, Importă) · **📊 Calcul** (sub-tab-uri: Detalii Venituri, Impozit & CASS) · **🧾 Depunere** (sub-tab-uri: Validează & Pregătește D212, Ghid Depunere) · **⚙ Avansat** (sub-tab-uri: Date Brute, Reguli & Referințe). Bara de sub-tab-uri apare automat sub bara principală când grupul are mai multe pagini. |
| **Selector limbă** | Comută între **RO** (Română) și **EN** (Engleză). Toate etichetele și indicațiile se actualizează instant. |
| **🖥️/🌙/☀️ Comutare temă** | Ciclează între **Auto** (🖥️ urmează preferința sistemului), **Întunecată** (🌙) și **Luminoasă** (☀️). Alegerea se salvează în browser. Graficele se re-desenează automat cu culorile noii teme. |
| **Selector an** | Alege anul fiscal vizualizat/editat. Lista afișează anii care au date, plus anul fiscal implicit (anul precedent). Toate tab-urile se actualizează la schimbarea anului. |
| **↻ Reset an** | (Avansat) Șterge toate datele pentru anul afișat — fișierele brute, JSON parsate, intrările D205 și confirmările de tranzacție. Necesită confirmare. |

### Bara de jos (Footer)

| Element | Descriere |
|---------|-----------|
| **Versiunea aplicației** (ex: v1.1.4) | Click pentru a vedea istoricul complet de versiuni |
| **Sursa datelor** | Arată de unde provin datele (ANAF, BNR, Fidelity, XTB) |
| **Contact** | Link email către autor |
| **Repornire Server** | Repornește serverul Node.js (pagina se reîncarcă automat) |
| **Banner actualizare** | Apare în partea de jos a paginii când o versiune mai nouă este disponibilă pe GitHub. Click pe **Actualizează** pentru a descărca și instala noua versiune direct din aplicație. Datele și documentele sunt păstrate. Banner-ul reapare la fiecare pornire până când instalați actualizarea. |
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

## 5. Tab 2 — 📥 Date (Adaugă/Editează + Importă)

Tab-ul **Date** grupează cele două fluxuri de intrare a datelor sub o singură bară de sub-tab-uri: **Adaugă/Editează** (input manual) și **Importă** (încărcare PDF/imagine/XML).

### 5.1 Sub-tab Adaugă/Editează

Folosește acest sub-tab pentru a introduce sau suprascrie manual datele financiare pentru anul selectat. Datele introduse aici au prioritate față de datele din documente importate.

#### Cardul Venituri și Deduceri

| Câmp | Descriere |
|------|-----------|
| **Dividende SUA (USD)** | Total dividende brute primite de la brokerul SUA (Fidelity / Morgan Stanley) |
| **Dividende România (RON)** | Total dividende primite de la brokerul din România |
| **Vânzări Acțiuni SUA (USD)** | Total încasări brute din vânzarea de acțiuni SUA |
| **Cost achiziție ESPP (USD)** | Costul plătit pentru acțiunile ESPP. Pentru acțiuni gratuite (stock awards), introdu 0. Se deduce din încasări pentru calculul câștigurilor impozabile. |
| **Venit impozitat deja ca salariu (RON)** | Beneficiul în natură (BIK) din stock awards impozitat prin salariul din România. Auto-calculat din documentele Stock Award importate; suprascrie aici dacă e nevoie. |
| **Pierderi fiscale din anii precedenți (RON)** | Pierderi din transferul titlurilor de valoare din anii precedenți (max 7 ani reportare). Conform D212 Rd.5-6, pot fi compensate max 70% din câștigul net al anului curent. Introduceți totalul pierderilor disponibile pentru reportare. |
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

### 5.2 Sub-tab Importă

Încarcă PDF-uri, imagini sau DUF XML pentru a extrage automat datele financiare.

#### Cum se importă

1. **Selectează anul** folosind butoanele de alegere an
2. **Selectează tipul documentului** din lista derulantă (grupată în 6 optgroups: Fidelity / Morgan Stanley / XTB / BT / Revolut / ANAF)
3. **Alege unul sau mai multe fișiere** (PDF, imagine — JPG, PNG, GIF, BMP, TIFF, WebP — sau XML pentru DUF)
4. Click pe **Încarcă și Procesează**

Datele extrase sunt parsate și salvate automat. Un mesaj de succes/eroare apare. Sub formular, panoul **„Documente deja importate"** listează fișierele procesate pentru anul curent, cu buton de ștergere per document.

#### Tipuri de documente acceptate

| Tip document | Sursă | Ce extrage |
|--------------|-------|------------|
| **ANAF - Declarație Unică D-212** | Portalul ANAF | Dividende (USD/RON), câștiguri capital, CASS, curs, impozit total |
| **ANAF - DUF XML pre-completat** | Portalul ANAF (Preluare/modificare date) | Capitolul I.1 (cap11Rows), Capitolul I.4 (dividende străine), `<oblig_realizat>`, CASS — folosit la diff-ul din tab-ul Depunere |
| **SUA (Fidelity) - Raport Investiții** | Fidelity (PDF anual) | Total dividende, impozite reținute, valoare cont, câștiguri nete |
| **ANAF - Adeverință de Venit** | Angajator (document salarial) | Venituri din dobânzi, impozit dobânzi plătit, venituri și impozit jocuri noroc |
| **MSFT - Document Stock Award** | Fluturaș / portal beneficii | Intrări individuale reținere acțiuni (date + sume în RON) |
| **SUA (Fidelity) - Confirmare Tranzacție** | Fidelity (PDF per tranzacție) | Tranzacții individuale: data, simbol, acțiuni, preț, încasări, comisioane. Suportă **mai multe fișiere** deodată. Deduplicare după număr referință. |
| **SUA (Morgan Stanley) - Stock Plan Statement** | Morgan Stanley (PDF anual) | Vânzări (brut, taxe, net), eliberări RSU, dividende, impozit IRS reținut |
| **România (XTB) - Dividende și Dobânzi** | Cont XTB (RAPORT DIVIDENDE) | Dividende (brut, impozit reținut), dobânzi (brut, impozit reținut), suport multi-valută (RON/EUR/USD) |
| **România (XTB) - Portofoliu** | Cont XTB (FIȘĂ PORTOFOLIU) | Câștiguri pe termen lung și scurt, impozit reținut, defalcare pe țări, multi-valută |
| **România (BT Capital Partners)** | bt-trade.ro | Tranzacții, dividende, dobânzi prin brokerul BT, multi-valută EUR/USD |
| **Revolut (Consolidated Statement)** | Revolut Securities Europe | Vânzări de acțiuni, dividende (cu impozit reținut la sursă), dobânzi |
| **România (Tradeville) - Fișă Portofoliu** | Tradeville | Portofoliu, câștiguri/pierderi, dividende (necesită PaddleOCR) |
| **SUA (Fidelity) - Extras de Cont** | Fidelity (raport periodic) | Acțiuni vândute, transferuri (către XTB), dividende YTD, totaluri tranzacții |
| **Tax Form - 1042-S (multi-formular)** | Formular IRS | Venit brut, impozit federal reținut, cod venit. Suport pentru PDF-uri cu mai multe formulare. Pentru dividende (cod 06), are prioritate față de raportul de investiții. |

#### Sfaturi
- **Motor OCR:** Aplicația detectează automat PaddleOCR (versiunea Full) sau revine la Tesseract.js (versiunea Lite). Motorul activ este afișat ca insignă în partea de sus a tab-ului Import.
- **Butoane Upgrade / Downgrade:** Lângă insignă, click pe **Upgrade la Full** pentru a instala PaddleOCR (~1,7 GB) sau **Downgrade la Lite** pentru a-l șterge — totul din aplicație, fără repornire.
- **PaddleOCR** oferă rezultate mult mai bune pentru documente scanate, în special tabele complexe precum Fișa de Portofoliu Tradeville.
- **Imaginile** (capturi de ecran, fotografii) sunt procesate cu OCR. Durează câteva secunde.
- Dacă calitatea OCR este prea scăzută, aplicația te va îndruma să introduci datele manual în tab-ul Adaugă/Editează.
- **Confirmările de tranzacție** suportă încărcarea mai multor fișiere simultan — fiecare fișier este parsat separat și adăugat (cu deduplicare).
- **Formularele 1042-S** sunt deduplicate după identificatorul unic — reîncărcarea aceluiași formular nu creează duplicate.

---

## 6. Tab 3 — 📊 Calcul (Detalii Venituri + Impozit & CASS)

Tab-ul **Calcul** grupează cele două vederi analitice: **Detalii Venituri** (defalcare per categorie cu insigne de sursă) și **Impozit & CASS** (calculul final + asistentul D212).

### 6.1 Sub-tab Detalii Venituri

Afișează defalcarea detaliată a veniturilor cu toate cifrele din spatele calculelor.

#### Insigne de sursă + detector de conflicte (nou în v1.6.0)

Fiecare cifră afișată este însoțită de o **insignă de sursă** care indică de unde provine valoarea:
- 🔵 **DUF** — preluată din DUF XML pre-completat de ANAF
- 🟢 **Local** — calculată din documentele tale importate (Fidelity, XTB, BT, Revolut, 1042-S etc.)
- 🟣 **Manual** — introdusă manual în tab-ul Date → Adaugă/Editează
- 🟡 **D205** — extrasă din raportul D205 al plătitorului

Când valoarea ANAF (DUF) **diferă** de valoarea local calculată, apare un **⚠️ avertisment de conflict** cu butonul „Vezi diferențele" care deschide diff-ul side-by-side din tab-ul Depunere.

#### Tabelul principal de venituri

Fiecare rând reprezintă o categorie de venit:

| Rând | USD | RON | Impozit SUA | Impozit RO |
|------|-----|-----|-------------|------------|
| Dividende SUA | ✓ | ✓ (convertit) | 10% reținut (convenție) | 0% (fără dublă impozitare) |
| Dividende România | - | ✓ | - | 8-16% (reținut de broker) |
| Dividende străine (alte țări) | - | ✓ | per țară | per țară, cu credit fiscal limitat la cota RO |
| Vânzări acțiuni SUA | ✓ | ✓ (convertit) | - | 10-16% |
| Vânzări acțiuni România ≥1an | - | ✓ | - | 1-3% (final, reținut) |
| Vânzări acțiuni România <1an | - | ✓ | - | 3-6% (final, reținut) |
| Venituri din dobânzi (RO + străine) | - | ✓ | - | 10-16% |
| Venituri jocuri noroc | - | ✓ | - | Deja reținut |

#### Deduceri Reținere Acțiuni

Afișează intrările individuale de reținere din acțiuni din fluturaș (importate prin documentul **MSFT - Stock Award**). Aceste sume se deduc din impozitul total datorat.

#### Vânzări Acțiuni România

Vedere detaliată a tranzacțiilor prin brokerul din România (XTB, BT Capital Partners), defalcate pe:
- **≥1 an** perioadă de deținere (cotă mai mică)
- **<1 an** perioadă de deținere (cotă mai mare)
- **Dividende** primite prin brokerul românesc
- **Dobânzi** câștigate prin brokerul românesc
- **Multi-valută** — XTB și BT acceptă RON, EUR și USD; valorile sunt convertite la cursul mediu BNR

#### Vânzări Acțiuni SUA (Confirmări Tranzacții)

Lista tranzacție cu tranzacție din confirmările brokerului SUA (Fidelity). Afișează data, simbolul, numărul de acțiuni vândute, prețul, încasările, comisioanele și încasările nete.

### 6.2 Sub-tab Impozit & CASS

Cel mai important sub-tab — arată exact ce datorezi și oferă asistentul de completare D212.

#### Sumarul Calculului de Impozite

Împărțit în 3 secțiuni clar etichetate:

##### 💰 Secțiunea A: Ce am câștigat (Venituri brute)
Listează toate categoriile de venituri cu valorile în RON:
- Câștiguri capital SUA, dividende SUA
- Câștiguri capital România (≥1an și <1an), dividende România
- Dividende străine (alte țări), defalcate per țară
- Venituri din dobânzi, venituri jocuri de noroc
- Venit net PFA (dacă este activat — vezi Secțiunea 10)
- **Total venituri din investiții**

##### ✅ Secțiunea B: Ce s-a plătit deja (Reținut la sursă)
Afișează ce a fost deja colectat:
- Impozit dividende reținut în SUA (10% conform convenției RO-SUA)
- Impozit dividende străine reținut (per țară, cu credit fiscal)
- Impozit câștiguri reținut de broker România (impozit final, 1%/3%)
- Impozit dividende reținut de broker România
- Impozit dobânzi reținut
- Rețineri din stock awards
- **Total deja plătit**

##### 📝 Secțiunea C: Ce mai am de plătit (Obligații D212)
Ce rămâne de declarat și plătit:
- Impozit câștiguri capital SUA (10%)
- Impozit dividende SUA (de obicei 0 — convenție)
- Impozit dividende străine (diferență dacă reținerea străină < cota RO)
- Elemente broker România (marcate ca „Impozit final — reținut la sursă, nu se declară")
- Impozit dobânzi rămas
- CASS investiții (3 paliere) și CASS PFA (4 paliere, dacă activ)
- Impozit pe venit PFA (10%)
- Deducere rețineri acțiuni
- **⚠ TOTAL DE PLĂTIT PE D212** — acesta este numărul care contează

##### Termen de plată
Afișat la final — termenul de depunere și plată D212 (ex: 25 mai 2026 pentru anul fiscal 2025).

#### CASS (Contribuția de Asigurări Sociale de Sănătate)

Defalcarea detaliată a calculului CASS:
- Afișează salariul minim brut și sistemul de paliere
- Evidențiază palierul tău activ
- Arată suma CASS datorată (separat pentru investiții vs. PFA)
- Listează tipurile de venituri supuse CASS
- Confirmă că CAS (pensie 25%) NU se aplică pentru venituri din investiții (se aplică doar la PFA cu venit > 12 SM)

**Sistemul de paliere CASS pentru venituri din investiții (2025):**

Conform instrucțiunilor D212 pct. 52.1.1–52.1.3, CASS pentru venituri din investiții este plafonat la **24SM** (3 paliere).
Palierul 60SM se aplică doar activităților independente (PFA, vezi Secțiunea 10), nu veniturilor din investiții.

| Palier | Interval venituri | Baza CASS | Suma CASS |
|--------|-------------------|-----------|-----------|
| <6 SM | < 24.300 RON | - | 0 |
| 6-12 SM | 24.300 - 48.600 | 24.300 | 2.430 |
| 12-24 SM | 48.600 - 97.200 | 48.600 | 4.860 |
| ≥24 SM | ≥ 97.200 | 97.200 | 9.720 |

*SM = salariu minim brut (4.050 RON/lună în 2025)*

#### Asistentul D212 (mod legacy)

Asistentul D212 clasic (text de copiat pas-cu-pas) este încă disponibil aici, dar pentru anul fiscal 2025+ recomandăm folosirea **tab-ului Depunere → Validează & Pregătește D212** și a exportului XML (vezi Secțiunea 7).

---

## 7. Tab 4 — 🧾 Depunere (Validează & Pregătește + Ghid Depunere)

Tab-ul **Depunere** este **nou în v1.6.0** și grupează fluxul complet de pregătire și submitere a D212. Conține două sub-tab-uri.

### 7.1 Sub-tab 🔬 Validează & Pregătește D212

Acest sub-tab este punctul central pentru a confrunta valorile **ANAF (din DUF XML pre-completat)** cu valorile **locale (calculate din documentele tale)** și a alege ce trimiți la ANAF.

#### Pas 1 — Importă DUF XML

1. Conectează-te pe portalul ANAF → **Declarația Unică 212** → **Preluare/modificare date** → descarcă DUF XML
2. Folosește butonul **„Importă DUF XML"** din partea de sus a sub-tab-ului (sau încarcă fișierul din tab-ul Date → Importă)
3. Aplicația parsează:
   - `cap11Rows` (Capitolul I.1 — câștiguri capital România per tranzacție)
   - Capitolul I.4 (dividende străine per țară, cu credit fiscal)
   - Blocul `<oblig_realizat>` (sumar obligații, CASS, impozit final)
   - Date personale (CNP, adresă, IBAN) — Capitolul I.5

#### Pas 2 — Diff side-by-side ANAF vs. Local

Pentru fiecare rând și valoare, aplicația afișează un tabel cu trei coloane:
- **ANAF (DUF)** — ce a pre-completat ANAF
- **Local** — ce a calculat aplicația din documentele tale
- **Selector** — radio buton pentru a alege ce versiune să folosești în XML-ul final

Diferențele sunt evidențiate vizual:
- ✅ **Identic** — ANAF și local coincid
- ⚠️ **Diferență mică** (< 10 RON) — probabil rotunjire
- 🔴 **Diferență mare** — necesită atenție

#### Pas 3 — Cross-check D205 per plătitor

Aplicația citește toate intrările D205 raportate de plătitori (extrase din DUF sau încărcate manual) și le compară cu calculele tale per plătitor (CUI/CIF). Matcher-ul are 5 niveluri:
- 🟢 **Exact** — sumele coincid perfect
- 🟡 **Aproape** — diferență < 5%
- 🟠 **Posibil** — diferență 5-20%
- 🔴 **Doar ANAF** — plătitor declarat de ANAF dar fără document local
- 🔵 **Doar local** — calcul local fără raport D205 corespondent

#### Pas 4 — Exportă D212 XML

Click pe **„📤 Exportă D212 XML"**. Aplicația emite un fișier XML aliniat 100% cu structura DUF:
- Cap I.1 (`cap11Rows`) cu câștigurile/pierderile RO per tranzacție
- Cap I.4 cu dividendele străine per țară (credit fiscal limitat la cota RO)
- Blocul `<oblig_realizat>` cu sumarul obligațiilor + CASS investiții
- Date personale (CNP, IBAN, adresă)

Acest XML poate fi încărcat direct pe portalul ANAF în secțiunea „Import declarație".

### 7.2 Sub-tab 🧾 Ghid Depunere D212

Parcurgere pas cu pas a fluxului oficial DUF cu **capturi de ecran anonimizate** și un **tabel de mapare DUF** (câmp ANAF → câmp aplicație):

1. **Autentificare** pe portalul ANAF cu certificat digital
2. **Preluare/modificare date** — descărcare DUF XML
3. **Capitolul I — Date personale și venituri** — câmpuri DUF mapate la valorile aplicației
4. **Capitolul I.1 — Câștiguri capital RO** — rândurile `cap11Rows`
5. **Capitolul I.4 — Dividende străine** — per țară, cu credit fiscal
6. **Sumar obligații** — `<oblig_realizat>`, CASS, impozit final
7. **Submitere** — export XML din aplicație → import pe portalul ANAF → verificare → semnare → submitere
8. **Plată** — generare ordin de plată, scadență 25 mai

Toate capturile sunt anonimizate (CNP/IBAN/nume cenzurate) și sunt incluse în pachetul aplicației la `public/assets/screenshots/`.

---

## 8. Tab 5 — ⚙ Avansat (Date Brute + Reguli & Referințe)

Tab-ul **Avansat** grupează două instrumente pentru utilizatorii avansați și contabili: **Date Brute** (inspecție/editare fișiere) și **Reguli & Referințe** (catalog reguli fiscale).

### 8.1 Sub-tab Date Brute

Vizualizează, editează sau șterge textul brut extras din documentele importate.

#### Controale

| Buton | Descriere |
|-------|-----------|
| **Selectează Fișier** | Alege ce fișier de date brute să vizualizezi (ex: `investment_2025_raw.txt`) |
| **Editare** | Treci în modul editare — conținutul devine editabil |
| **Salvează** | Salvează modificările în fișierul text |
| **Anulează** | Renunță la modificări și revine la modul vizualizare |
| **Șterge** | **Șterge permanent** fișierul text ȘI datele parsate asociate. Necesită confirmare. |

#### Ce fișiere sunt stocate

Fiecare document importat creează un fișier text în `data/`:
```
adeverinta_2025_raw.txt
declaratie_2024_raw.txt
investment_2025_raw.txt
fidelity_statement_2025_raw.txt
trade_confirmation_2025_raw.txt
xtb_dividends_2025_raw.txt
xtb_portfolio_2025_raw.txt
bt_trades_2025_raw.txt
revolut_statement_2025_raw.txt
form_1042s_2025_raw.txt
duf_2025_raw.xml
```

#### Când să folosești Șterge (Purge)
- Dacă ai importat documentul greșit
- Dacă vrei să reimportezi o versiune corectată (șterge mai întâi, apoi reimportează)
- Ștergerea `trade_confirmation_*` șterge și `trades.json`
- Ștergerea `stock_award_*` șterge și `stock_awards.json`
- Pentru a șterge **TOATE** datele unui an, folosește butonul **↩ Reset An** din header (mai rapid)

### 8.2 Sub-tab Reguli & Referințe (nou în v1.6.0)

Pagină **căutabilă** dedicată contabililor și utilizatorilor care vor să verifice baza legală a fiecărui calcul. Fiecare regulă afișează:
- **ID regulă** (ex: `R-CASS-INV-24SM`)
- **Descriere** umană
- **Articolul din Codul fiscal** (ex: Art. 170 alin. (1) Cod fiscal)
- **Paragraful din Instrucțiunile D212** (ex: pct. 52.1.2)
- **Exemplu de aplicare** (când există)

#### Categorii de reguli
- **Impozit pe venit** — dividende, dobânzi, câștiguri capital (cote 2019-2026+)
- **CASS investiții** — paliere 6/12/24 SM, plafonare, exclude veniturile reținute final
- **CASS PFA** — paliere 6/12/24/60 SM, opt-in art. 180(2)
- **Credit fiscal extern** — limitare la cota RO, per țară, dovedire reținere străină
- **Pierderi reportate** — max 70% din câștigul anului, reportare 7 ani
- **D205** — categorii de venit, mapare per plătitor

#### Căutare
Bara de căutare filtrează regulile în timp real după ID, descriere, articol sau cuvânt-cheie.

---

## 9. Logica fiscală și reguli

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

*„Valoare impozitată ca salariu" = sumele menționate în fluturaș sub „Stock award BIK" și/sau „ESPP gain BIK". Acestea reprezintă venitul (FMV la vesting) deja impozitat ca salariu, și sunt deduse din câștigurile de capital ca bază de cost conform D212 Rd.2 „Cheltuieli deductibile". Notă: „Stock withholding" este impozitul plătit pe BIK (afișat ca „deja plătit"), nu baza de cost.*

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

## 10. Suport PFA (activități independente)

**Nou în v1.6.0.** Aplicația suportă deponenții **PFA** (Persoană Fizică Autorizată — activități independente în sistem real, art. 64-67 Cod fiscal) care declară venituri PFA alături de veniturile din investiții pe aceeași D212.

### Activare

În sub-tab-ul **Date → Adaugă/Editează**, există un card nou **„Venituri PFA — activități independente"**. Bifează opțiunea **„Am venituri PFA pentru acest an"** pentru a-l activa.

### Câmpuri

| Câmp | Descriere |
|------|-----------|
| **Venit brut PFA (RON)** | Total încasări din activitatea independentă (sistem real) |
| **Cheltuieli deductibile (RON)** | Cheltuieli aferente activității (chirie, utilități, materiale, etc.) |
| **Venit net PFA (RON)** | Auto-calculat: Brut − Cheltuieli. Editabil dacă declari direct net. |
| **Opt-in art. 180(2)** | Bifă pentru cei care optează voluntar la baza CASS = venit net (în loc de palier) |
| **CAS (pensie)** | Auto-aplicat dacă venit net > 12 SM. Cota 25% pe baza aleasă. |

### Sistem paliere CASS PFA (2025)

**Diferit** de paliere investiții — PFA are 4 paliere, plătite voluntar sub 6 SM:

| Palier | Interval venit net | Baza CASS | Suma CASS (10%) |
|--------|--------------------|-----------|-----------------|
| <6 SM | < 24.300 RON | voluntar (6 SM) | 2.430 (opțional) |
| 6-12 SM | 24.300 - 48.600 | 24.300 | 2.430 |
| 12-24 SM | 48.600 - 97.200 | 48.600 | 4.860 |
| 24-60 SM | 97.200 - 243.000 | venit net efectiv | 10% × net |
| ≥60 SM | ≥ 243.000 | 243.000 (plafon) | 24.300 |

### Impact pe D212

- Venitul net PFA este adăugat la **Capitolul I.1** al D212 ca venit din activități independente
- CASS PFA și CAS (dacă e cazul) sunt **separate** de CASS investiții — ambele apar în sumarul obligațiilor
- XML-ul exportat din tab-ul Depunere include blocul `<venituriActivitatiIndependente>` plus contribuțiile corespunzătoare

---

## 11. Suport multi-valută (RON / EUR / USD)

**Extins în v1.6.0.** Brokerii români **XTB** și **BT Capital Partners** pot raporta tranzacții în mai multe valute (RON, EUR, USD). Aplicația detectează automat valuta per linie și convertește la cursul mediu BNR al anului.

### Cursuri BNR integrate

| An | EUR/RON | USD/RON |
|----|---------|---------|
| 2019 | 4.7452 | 4.2379 |
| 2020 | 4.8371 | 4.2440 |
| 2021 | 4.9204 | 4.1604 |
| 2022 | 4.9315 | 4.6884 |
| 2023 | 4.9465 | 4.5683 |
| 2024 | 4.9750 | 4.5982 |
| 2025 | 5.0700 | 4.6700 (provizoriu) |

### Cum funcționează

1. Parserul broker detectează valuta liniei (din simbol `RON`/`EUR`/`USD` sau coloana valută)
2. Conversia se face cu cursul mediu anual BNR — transparent în tab-ul **Detalii Venituri** (insignă valută + curs aplicat)
3. Dividende reținute în EUR sau USD prin broker român sunt convertite la RON și adunate la totalul `dividendePrinBrokerRO`
4. Detector de conflicte semnalează când valoarea convertită diferă de ce a raportat ANAF (DUF)

### Note

- Pentru brokerii **străini** (Fidelity, Morgan Stanley, Revolut), conversia rămâne la cursul BNR per anul fiscal
- Pentru brokerii **români**, dividende în valută străină (ex: dividende Microsoft via XTB) sunt impozite finale (reținute de broker) și nu se redeclar

---

## 12. ANAF Audit Pack (export ZIP determinist)

**Nou în v1.6.0.** Pentru cazul în care ANAF cere documente justificative (în general 5 ani de la depunere), aplicația poate genera un **ZIP determinist** care conține tot ce trebuie pentru un audit.

### Cum se generează

În tab-ul **🧾 Depunere → 🔬 Validează & Pregătește D212**, după ce ai exportat XML-ul, apare butonul **"📦 Export ANAF Audit Pack"**. Click → se salvează `D212-AuditPack-{An}-{Hash}.zip`.

### Conținut

ZIP-ul include (în structură ierarhică explicită):

```
D212-AuditPack-2025-abc123/
├── README.txt                    # Index al pachetului + sume de control
├── manifest.json                 # Versiune aplicație, dată export, an fiscal, hash
├── raw/                          # Fișiere brute ale documentelor importate
│   ├── investment_2025_raw.txt
│   ├── trade_confirmation_2025_raw.txt
│   ├── xtb_dividends_2025_raw.txt
│   └── … (toate fișierele _raw.txt)
├── parsed/                       # Date parsate JSON
│   ├── parsed_data_2025.json
│   ├── trades_2025.json
│   └── stock_awards_2025.json
├── d205/                         # Intrări D205 per plătitor
│   └── d205_2025.json
├── d212/                         # XML D212 generat
│   ├── d212_2025.xml
│   └── d212_2025_anaf_duf.xml    # DUF original ANAF (dacă importat)
└── trace/                        # Trace de aplicare reguli
    ├── rules_applied.json        # Reguli aplicate cu citate Cod fiscal
    └── calculation_audit.json    # Pas-cu-pas calcul venituri → impozit → CASS
```

### Determinismul

ZIP-ul este **bit-identic** la export repetat pe aceleași date:
- Timpurile fișierelor sunt fixate la `1980-01-01 00:00:00` (constanta ZIP)
- Ordinea fișierelor este alfabetică stabilă
- CRC32 calculat per fișier
- Hash-ul SHA256 al ZIP-ului apare în numele fișierului și în manifest

Aceasta permite **verificarea integrității** la cerere ANAF — contabilul poate re-rula exportul și compara hash-ul.

### Implementare

ZIP-ul este creat cu implementarea proprie `lib/minizip.js` — **zero dependențe externe** — pentru a garanta același output indiferent de versiunea Node.js sau platformă.

---

## 13. Administrarea datelor

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

## 14. Versiunea portabilă

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
| `README.md` | Instrucțiuni de pornire rapidă (Română) |

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

## 15. Depanare

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

## 16. Istoric versiuni aplicație

Vezi istoricul complet făcând click pe numărul versiunii din footer-ul aplicației, sau consultă:
- [CHANGELOG.en.md](CHANGELOG.en.md) (Engleză)
- [CHANGELOG.ro.md](CHANGELOG.ro.md) (Română)

### Versiunea curentă: v1.6.0 (12.06.2026)

**Schimbări majore aduse de develop branch peste cut-ul inițial v1.6.0 (12.05.2026):**
- **🗂️ Navigare refactorizată** — 6 tab-uri plate → 5 tab-uri grupate (Panou Principal · Date · Calcul · Depunere · Avansat) cu sub-tab-uri
- **🧾 Ghid Depunere D212** — parcurgere oficială a fluxului DUF cu capturi anonimizate
- **🔬 Validează & Pregătește D212** — import DUF XML, diff side-by-side ANAF vs. local, selector ANAF/Local per rând, cross-check D205
- **📤 Export D212 XML** — emite XML aliniat 100% cu structura DUF (cap11Rows, cap14, oblig_realizat, CASS)
- **📥 Tab Date în două moduri** — Adaugă/Editează + Importă cu panou „Documente deja importate”
- **🆕 Brokeri noi** — BT Capital Partners (bt-trade.ro) și Revolut Securities Europe (consolidated statement)
- **💼 Suport PFA** — activități independente, scara CASS 6/12/24/60 SM, opt-in art. 180(2)
- **⚖️ Pagina Reguli & Referințe** — catalog căutabil cu citări Cod fiscal + Instr. D212
- **📦 ANAF Audit Pack** — export ZIP determinist (CRC + timestamp-uri stabile) pentru audit
- **🔢 Refactor calcul** — source-resolver: fiecare valoare știe de unde provine (DUF/Local/Manual/D205)
- **💱 Multi-valută prin broker RO** — EUR și USD prin XTB și BT cu cursuri BNR 2019-2025
- **🐛 Fix-uri parser 1042-S** — suport PDF-uri multi-formular, deduplicare per ID unic
- **🧪 Teste** — suită extinsă cu peste 100 de teste node:test (zero dep)
- **🛡️ CI/Igienă** — matrice Node 18/20/22 pe ubuntu-latest + job `pr-cleanliness`
- **🛠️ Module interne noi** — `lib/source-resolver.js`, `lib/rules-catalog.js`, `lib/d205-matcher.js`, `lib/d212-xml-builder.js`, `lib/audit-pack-builder.js`, `lib/minizip.js`

### Versiunea anterioară: v1.5.3 (19.04.2026)

Tooltip-uri detaliate pe toate rândurile de venituri (rețineri, credite, deduceri), input manual impozit dobânzi plătit, grafice ascunse fără date, notă de subsol cu exemplu deducere 40% pe chirii/drepturi IP, 4 tipuri noi de venituri, corecturi conformitate ANAF, refacere panou principal.

---

*D212 Asistent Fiscal © 2026 | Contact: spatariu74@gmail.com*
