# D212 Asistent Fiscal - Istoric versiuni

## v3.1.1 (2026-04-09)

### Corecturi
- **Linkuri Changelog în Ghid** — click pe CHANGELOG.en.md / CHANGELOG.ro.md din Ghid deschide acum o fereastră Changelog suprapusă în loc să navigheze în afară
- **Build portabil: README.ro.md** — README-ul în română lipsea din build-urile portabile
- **Build portabil: Upgrade-to-Full.bat** — acum inclus în ambele build-uri Lite și Full (necesar după downgrade)
- **Build portabil: README generat** — listează Upgrade-to-Full.bat și Downgrade-to-Lite.bat, menționează butonul de upgrade din aplicație

---

## v3.1.0 (2026-04-09)

### Gestionare Motor OCR
- **Butoane Upgrade la Full / Downgrade la Lite** — comutare între PaddleOCR și Tesseract.js direct din tab-ul Importă Document
- **Instalare PaddleOCR din aplicație** — butonul "Upgrade la Full" descarcă Python 3.12 + PaddleOCR (~1,7 GB) fără a părăsi aplicația
- **Dezinstalare PaddleOCR din aplicație** — butonul "Downgrade la Lite" șterge folderul python/ pentru a elibera spațiu pe disc
- **Spațiu real pe disc** — mesajul de downgrade arată dimensiunea reală a folderului PaddleOCR (nu estimată)
- **Mesaj informativ** — mesajul ℹ deschide Ghidul de Utilizare cu detalii despre upgrade/downgrade
- Insigna OCR, butonul și mesajul se actualizează live după instalare/dezinstalare (fără repornire)
- Fix cache detectare OCR — upgrade-ul nu mai eșuează silențios din cauza cache-ului învechit

### Îmbunătățiri Date Brute
- **Ștergere multiplă** — căsuțe de selectare pe fiecare fișier cu "Selectează tot" și bara "Șterge Selectate"
- Mesaje de confirmare separate pentru ștergere parțială vs. totală

### Îmbunătățiri Vizualizator Documente
- **Buton Înapoi sus** — buton ↑ în ferestrele Istoric versiuni, Citește-mă și Ghid (apare la derulare)
- **Linkurile ancora funcționează în ferestre** — linkurile din Cuprins derulează în fereastra modală în loc să navigheze în afară
- **Tratare liniuță em** — titlurile cu caractere — generează ID-uri ancora corecte
- Linkurile din Ghid/Citește-mă cu ancore #secțiune derulează lin la titlul țintă

### Corecturi
- Insigna și mesajele OCR se traduc corect la schimbarea limbii
- Fix cache detectare PaddleOCR care împiedica upgrade/downgrade

---

## v3.0.1 (2026-04-08)

### Îmbunătățiri
- **Ștergere multiplă în Date Brute** — căsuțe de selectare pe fiecare rând cu "Selectează tot" și bara "Șterge Selectate"
- Mesaje de confirmare separate pentru ștergere parțială vs. totală
- Suport bilingv (EN/RO) pentru toate textele noi de ștergere multiplă

---

## v3.0.0 (2026-04-08)

### Funcționalitate nouă: Integrare PaddleOCR
- **PaddleOCR (PP-StructureV3)** — înlocuiește Tesseract.js ca motor OCR principal pentru extragere superioară de text din documente scanate
- **Arhitectură Python subprocess** — PaddleOCR rulează prin Python Embeddable 3.12 inclus, apelat din Node.js via `child_process`
- **Extragere Tradeville Portfolio** — PDF-urile scanate Fișă de Portofoliu se parsează corect acum (anterior imposibil cu Tesseract)
- **Auto-detectare motor OCR** — serverul detectează disponibilitatea PaddleOCR la pornire, revine automat la Tesseract.js
- **Insignă status OCR** — tab-ul Importă Document arată ce motor OCR este activ (verde = PaddleOCR, galben = Tesseract)
- **Motor OCR în rezultate** — răspunsurile la upload includ ce motor a procesat documentul
- **Două variante portabile** — `npm run build` (Lite ~174 MB, doar Tesseract) și `npm run build:full` (Full ~1,9 GB, cu PaddleOCR)

### Detalii tehnice
- `ocr_service.py` — serviciu CLI Python folosind API-ul PaddleOCR 3.x `predict()`
- `setup_paddleocr.js` — descarcă Python Embeddable + instalează pachetele PaddleOCR
- PaddlePaddle fixat la v3.0.0 (v3.3.1 are crash OneDNN pe Windows)
- `paddlex[ocr]` extra necesar pentru pipeline-ul complet OCR
- Fișierele temporare Multer redenumite cu extensia corectă (.pdf/.jpg) pentru detectarea formatului PaddleOCR
- Tipurile de documente auto-validate ocolesc verificarea generică de calitate OCR
- `GET /api/ocr-status` — endpoint nou pentru detectarea motorului OCR din frontend

---

## v2.4.0 (2026-04-08)

### Funcționalități noi
- **Parser Tradeville Portfolio** — România (Tradeville) - Fișă de Portofoliu (Câștiguri Capital)
- **Câștiguri RO pe țară** — tab Adăugare Date: rânduri dinamice per țară (40 țări)
- **Broker text liber** — scrie orice broker sau alege din sugestii
- **Listă fișiere Date Brute** — tabel cu nume, dată, butoane Vizualizează/Șterge
- **Link ANAF D212** — buton pe Calcul Impozit deschide formularul ANAF

### Corecturi
- Purge șterge doar tranzacțiile din sursa specifică
- Purge recalculează agregatele după ștergere
- Vânzări Acțiuni SUA "Plătit" = 0 (reținerea stock awards e deducere, nu impozit)
- Tradeville OCR: avertisment bilingv când tabelul nu poate fi citit
- API Date Brute returnează metadate fișiere
- Etichete tipuri documente: "Portfolio Statement" în engleză pentru XTB și Tradeville

---

## v2.3.0 (2026-04-08)

### Corecturi calcul (Audit conformitate ANAF)
- Impozit dividende SUA: calculează corect creditul fiscal pentru 2026+ (RO 16% - SUA 10% = 6% de plată)
- Rata impozit dobânzi: dinamică 10%/16% în funcție de an
- Rate câștiguri broker RO: dinamice 1%/3% sau 3%/6% în toate tabelele
- Baza CASS: tratament net consistent pentru toate tipurile de venit
- Variabila stock withholding: utilizare consistentă
- Sumar D212: nu mai dublează impozitul pe dobânzi
- Sume RON: rotunjite la lei întregi conform cerințelor ANAF

### Asistent completare D212
- Adăugat cost ESPP și detalii credit fiscal la secțiunea venituri străinătate
- Adăugat câștiguri capital broker România (≥1 an / <1 an) cu impozit reținut
- Adăugat dividende broker România cu impozit reținut
- Secțiune nouă "Venituri cu reținere la sursă" pentru CASS
- Titluri secțiuni corelate cu formularul ANAF D212

### Îmbunătățiri UI
- Buton link către formularul ANAF D212 — deschide https://www.anaf.ro/declaratii/duf într-o fereastră nouă
- Calcul impozit grupat în subsecțiuni SUA/România cu subtotaluri
- Dropdown tipuri documente reordonat logic
- Butonul "Se procesează" nu mai rămâne blocat
- Graficul cursului de schimb afișat doar când există date financiare

### Corecturi bug-uri
- Purge șterge complet datele 1042-S
- Purge curăță tranzacțiile din trades.json
- Obiectele an goale șterse după purge
- Eroare stockWithholding temporal dead zone rezolvată
- Scripturi migrație obsolete șterse

---

## v2.2.0 (2026-04-07)

### Actualizări
- **Express 5.2.1** — actualizat de la v4 (gestionare îmbunătățită erori async, suport Brotli)
- **Tesseract.js 7.0.0** — actualizat de la v5 (OCR cu 15-35% mai rapid via relaxedsimd WASM)
- **Multer 2.1.1** — actualizat de la v1 (rezolvat avertisment depreciere)
- Eliminat pachetul neutilizat `xlsx` (rezolvat vulnerabilitate de severitate mare)
- Actualizat `path-to-regexp` (rezolvat vulnerabilitate de severitate mare)
- **0 vulnerabilități, 0 deprecieri, 0 pachete învechite**

### Corecturi
- Prevenire crash OCR — serverul nu mai cade la PDF-uri bazate pe imagini
- Fereastră server ascunsă — Start.bat rulează invizibil în fundal
- Graficul cursului de schimb ascuns când nu există date
- LICENȚA inclusă în versiunea portabilă

---

## v2.1.0 (2026-04-07)

### Funcționalități noi
- **Parser Morgan Stanley Stock Plan Statement** — extras anual cu vânzări, RSU releases, dividende, reținere IRS
- **Selector broker** în tab-ul Adăugare Date — broker SUA (Fidelity / Morgan Stanley) și broker România (XTB)
- **Etichete dinamice broker** — meniurile Detalii Venituri și Calcul Impozit afișează brokerul real utilizat
- **Cursuri BNR oficiale** 2019-2025 (Serii anuale, valori medii)
- **Salariu minim brut** 2019-2026

### Corecturi
- **Algoritm fiscal**: reținerea stock awards se deduce doar din câștiguri de capital (nu din dividende)
- **Baza CASS**: folosește venitul net după deducerea reținerii stock awards
- **Formatare zecimale**: dividende și taxe mici afișate cu 2 zecimale
- **Precizie floating point**: totalul acțiunilor nu mai afișează valori ca `9.280999999999999`
- **Robustețe trades.json**: parsare defensivă previne crash pe date corupte
- **Error handler**: corectat `ReferenceError: type is not defined`

### Modificări
- Eliminat textul static "(Fidelity / Morgan Stanley)" — acum dinamic
- Selectorul de an afișează toți anii din cursurile de schimb (2019-2025)
- Start.bat lansează serverul minimizat și se închide imediat
- Curs BNR 2025 actualizat la valoarea oficială 4.4705

---

## v2.0.0 (2026-03-29)

### Principal
- Aplicația redenumită din „ANAF Panou Financiar" în „D212 Asistent Fiscal"
- Tab-ul Calcul Impozite reproiectat cu 3 secțiuni: Ce am câștigat / Ce s-a plătit deja / Ce mai am de plătit
- Suport cote impozitare 2026 (16% impozit venit, 3%/6% câștiguri XTB)
- Calculul CASS folosește dividende și dobânzi nete (validat cu studiu de caz)
- Costul de achiziție ESPP dedus din câștiguri de capital
- Capitolul II (opțiune CASS) marcat opțional pentru D212/2025+, cu verificare prag
- Import formular 1042-S (IRS) cu deduplicare după identificator unic
- 1042-S are prioritate față de Investment Report pentru dividende

### Funcționalități
- Câmp termen depunere D212 (calendar, per an, editabil)
- Termenul afișat în tabelul impozite și secțiunea CASS
- Tabel referință metode calcul câștiguri de capital (4 scenarii)
- Pași detaliați calcul dividende în asistentul D212
- Lista tipuri venituri CASS, termen plată, notă CAS nu se aplică
- Parsare venituri din jocuri de noroc din adeverința ANAF
- OCR fallback pentru PDF-uri scanate/imagine
- Detectare calitate OCR cu solicitare introducere manuală
- Sistem de loguri (folder logs/ cu fișiere zilnice)
- Cote XTB configurabile (citite din cotele salvate)
- Layout-uri grilă formulare (2/3 coloane responsive)
- Butoanele Salvează afișează anul selectat
- Banner an în afara cardurilor ca titlu secțiune
- Footer sticky similar cu header-ul
- Buton „Înapoi sus" poziționat deasupra footer-ului
- Versiune aplicație în footer cu istoric versiuni

### Îmbunătățiri
- Chart.js folosește .update() în loc de distruge/recreează (performanță)
- Culorile graficelor citite din variabile CSS (consistență temă)
- computeYearData() memorizat cu invalidare cache pe bază de versiune
- Formatare numere conform limbii selectate (ro-RO / en-US)
- Handler redimensionare cu debounce (150ms) pentru fluiditate
- Controale formular dezactivate în timpul încărcării fișierelor
- Notificare toast la eroare încărcare date
- Repornirea serverului creează proces nou înainte de oprire (auto-recuperare)
- PORT configurabil prin variabilă de mediu

### Accesibilitate
- Buton meniu hamburger: aria-label adăugat
- Canvas grafice: aria-label adăugat
- Selectoare din header: etichete sr-only pentru cititoare de ecran
- Butoane navigare: contur focus-visible
- Clasă utilitară .sr-only adăugată

### i18n
- Toate cele 321 chei echilibrate între EN și RO
- Numele aplicației din footer traductibil (D212 Tax Helper / D212 Asistent Fiscal)

---

## v1.0.0 (2026-03-24)

### Versiune inițială
- Panou principal cu 4 carduri sumar și 4 grafice
- Tab Detalii Venituri (dividende Fidelity, câștiguri capital, tranzacții XTB)
- Tab Calcul Impozite cu sistem CASS pe paliere (2023-2025)
- Asistent D212 (Capitolul I: venituri din străinătate, XTB, CASS, sumar obligații)
- D212 Capitolul II: opțiune plată CASS
- Tab Adaugă Date cu formulare de introducere manuală
- Tab Import Document (încărcare PDF/imagine cu OCR)
- Tab Date Brute (vizualizare/editare/ștergere text extras)
- Tipuri documente: declarație, raport investiții, adeverință venit, stock award, confirmare tranzacție, dividende XTB, portofoliu XTB, extras Fidelity
- Deduplicare confirmări tranzacție după număr referință
- Rețineri acțiuni din documente salariale
- Suport bilingv (RO/EN) cu sistem i18n
- Temă întunecată cu variabile CSS
- Design responsiv cu meniu hamburger
- Grafice comparație anuală
- Grafic cursuri de schimb (date BNR)
- Versiune portabilă cu Node.js inclus
