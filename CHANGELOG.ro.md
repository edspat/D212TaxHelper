# D212 Asistent Fiscal - Istoric versiuni

## v1.5.0 (2026-04-16)

### Performanță
- **Compresie Gzip** — toate răspunsurile HTTP sunt acum comprimate prin middleware-ul `compression`, reducând dimensiunea paginii cu ~60-70%
- **Cache dimensiune director Python** — `/api/ocr-status` nu mai parcurge 31.000+ fișiere la fiecare apel; calculat o singură dată la pornire și stocat în cache
- **Cache active statice** — fișierele JS, CSS și HTML servite cu `Cache-Control: max-age=1h`, eliminând descărcările redundante la reîncărcarea paginii
- **Chart.js non-blocant** — tag-ul script CDN schimbat de la blocant la `defer`, permițând randarea mai rapidă a paginii
- **Eliminat apel API duplicat** — `/api/stock-withholding` era apelat de două ori la încărcarea paginii (în `loadAllData` și `render`); acum apelat o singură dată
- **Încărcare inițială paralelă** — `loadAllData()` și `/api/version` acum apelate simultan în loc de secvențial

### UX Upgrade PaddleOCR
- **Progres per pachet** — `setup_paddleocr.js` instalează acum pachetele unul câte unul cu mesaje `[1/7] Instalare paddlepaddle==3.0.0 ...` în loc de o instalare silențioasă în bloc
- **Fără blocare la 99%** — bara de progres pip dezactivată (`--progress-bar off`) în timpul upgrade-ului pentru a preveni afișarea înghețată
- **Timeout crescut** — 15 minute per pachet (de la 10 minute în total) pentru conexiuni mai lente

---

## v1.4.6 (2026-04-16)

### Integrare ESPP & Stock Award
- **Suport achiziție ESPP** — parserul Confirmare Tranzacție detectează acum `YOU PURCHASED` (ESPP) alături de `YOU SOLD`, extrăgând Valoare Piață, Contribuții Acumulate, Câștig ESPP și Perioadă de Ofertă
- **Cost ESPP FIFO** — costul achiziției ESPP (contribuții $) este urmărit automat prin FIFO pe mai mulți ani și scăzut din încasările vânzării în USD înainte de conversia în RON, conform formulei ANAF D-212
- **Tabele separate ESPP/Vânzări** — tranzacțiile cu acțiuni SUA împărțite în două tabele: "Achiziții Acțiuni ESPP SUA" și "Vânzări Acțiuni SUA", fiecare cu totaluri proprii
- **Urmărire consum ESPP** — tooltip pe rândul câștiguri SUA arată ce loturi ESPP au fost consumate

### Deducere BIK Stock Award
- **"Venit impozitat deja ca salariu" (BIK)** — valorile stock_award_bik din documentele Stock Award importate sunt însumate și deduse din câștigurile de capital conform regulilor ANAF D-212: `Impozabil = Vânzare_RON - Cost_RON - BIK_RON`
- **Încărcare multi-an** — documente Stock Award din ani diferiți pot fi încărcate sub un singur an fiscal pentru maximizarea deducerii BIK (ex: încarcă documentele 2019-2023 sub anul 2023 pentru a reduce pragul CASS)
- **Afișare pe an** — deducerea BIK și tabelul de rețineri apar doar pentru anii cu documente Stock Award încărcate
- **Suprascriere manuală BIK** — nou câmp "Venit impozitat deja ca salariu (RON)" în Adaugă Date
- **Rând separat de deducere** în tabelul detalii venituri cu stil verde și tooltip

### Îmbunătățiri Parser Stock Award
- **Suport date multi-format** — parserul gestionează `ZZ-Lun-AA` (2019-2023), `ZZ-Lun-AAAA` (2025) și `ZZ.LL.AAAA` (2024)
- **Fix antet îmbinat** — gestionează extragerea PDF unde anteturile coloanelor se îmbină
- **Mod adăugare** — încărcarea documentelor Stock Award suplimentare adaugă intrări cu deduplicare (fără suprascriere)
- **Ștergerea curăță tot** — ștergerea unui fișier stock_award elimină TOATE intrările stock award

### Registru Persistent
- **ledger.json** — nou sistem de urmărire a intrărilor financiare cu alocare FIFO a costului
- **Migrare automată** — tranzacțiile și stock award-urile existente sunt migrate automat la registru la prima pornire
- **Ștergere soft la purjare** — intrările șterse păstrate pentru audit
- **Endpoint-uri API** — `/api/ledger/allocations`, `/api/ledger/summary`, `POST /api/ledger/migrate`

### Modificări Tipuri Document
- **Eliminat** "SUA (Fidelity) - Extras de Cont (Raport Periodic)" (fidelity_statement)
- **Redenumit** Confirmare Tranzacție în "Confirmare Tranzacție (Vânzare / Achiziție)"

### Panou Principal & Grafice
- **Eliminat** căsuța "Impozit de Plată" (redundantă)
- **Graficele urmează anul selectat** — toate graficele afișează ani până la anul selectat
- **Izolare date pe an** — graficele calculează impozitele independent pe an
- **Anteturi no-cache** pentru fișierele JSON locale

### Îmbunătățiri Afișare
- **Date normalizate** — toate datele afișate în format `AAAA.LL.ZZ`
- **Tabelul de rețineri** afișează coloanele BIK și Reținere cu dată, sortate cronologic
- **Totaluri tabel venituri** calculate din rândurile efective (inclusiv deduceri cu +/-)

### Corecturi
- **Dubla numărare reținere** — corectat duplicatul `total += val` în API-ul withholding
- **Date vechi la ștergere** — ștergerea fișierelor curăță corect toate datele conexe
- **Ștergere confirmare tranzacție** — corectat bug variabilă (`filename` → `safeName`)
- **Calcul CASS** — deducerea BIK reduce corect baza CASS

---

## v1.4.5 (2026-04-15)

### Corecturi Conformitate Fiscală
- **Credit fiscal ANAF D-212** — la importul declarațiilor ANAF, aplicația folosește acum corect `difImpozitDatorat` (împozitul efectiv de plată după credit) în loc de `impozitDatoratRO` (impozit brut înainte de credit). Pentru dividende SUA cu convenție de dublă impunere, impozitul pe dividende apare ca **0** când impozitul reținut în SUA acoperă obligația fiscală românească.
- **Credit fiscal & impozit străin** — noi câmpuri `creditFiscalRON` și `difImpozitRON` extrase din PDF-urile ANAF (XFA și randate), propagate corect în Panou Principal, Detalii Venituri și Calcul Impozite
- **difImpozit câștiguri capital** — impozitul pe câștiguri capital folosește acum `difImpozitRON` din D-212 când este disponibil
- **Fallback impozit străin dividende SUA** — `foreignTaxRON` folosește corect datele D-212 când nu există raport Fidelity/1042-S

### Versiune
- **Schema unificată de versiuni** — toate versiunile renumerotate în seria 1.x.x pentru consistență

---

## v1.4.4 (2026-04-15)

### Îmbunătățiri Panou Principal
- **6 grafice** — reorganizate pe două rânduri a câte 3: Structura Veniturilor, Structura Impozitelor, Comparație pe Ani (rândul 1) și Total Impozite, Cursuri de Schimb, Salariu Minim (rândul 2)
- **Grafic Total Impozite** (nou) — grafic stivuit arătând Deja Plătit (verde), Impozit Venit (roșu) și CASS (violet) pe an, cu totaluri în tooltip
- **Comparație pe Ani afișează acum 5 ani** — extins de la 3 la 5 ani
- **Săgeți de navigare pe toate graficele multi-an** — Comparație pe Ani, Total Impozite, Cursuri de Schimb și Salariu Minim afișează ◀▶ când sunt 6+ ani de date

### Modificări Etichete
- **"Total de Plătit (D212)"** redenumit în **"Impozit Venit"** în căsuțele panoului și legendele graficelor
- **"Plată Totală D212"** redenumit în **"Total Impozite"**

### Corecturi
- **Parser PDF imagine ANAF D-212** — corectat parsarea declarațiilor 2020-2022 cu doar dividende (secțiune țară unică), formatul vechi cu 9 câmpuri vs formatul nou cu 7, și detecția limitelor de secțiuni prin linii goale

---

## v1.4.3 (2026-04-14)

### Funcționalități Noi
- **Import ANAF D-212 (PDF-uri XFA)** — importă PDF-urile oficiale ANAF Declarația Unică D-212 extragând datele XML încorporate direct din stream-urile FlateDecode (fără OCR)
- **Import ANAF D-212 (PDF-uri randate/imagine)** — parsează PDF-urile randate ANAF cu straturi text conținând semnătura "FORMULAR VALIDAT", gestionând formatul special de numere (ex: "18 .424" = 18424)
- **Câmpuri extrase** — câștiguri capital (venit impozabil, impozit datorat), dividende (brut, impozit străin, impozit datorat RO), contribuție CASS, total obligații fiscale
- **Detecție automată format** — parserul declarației gestionează acum 3 formate PDF: formulare dinamice XFA, PDF-uri randate ANAF și rapoarte Think People

### Corecturi
- **Ferestre CMD/PS ascunse** — toate operațiile cu procese (detecție PaddleOCR, procesare OCR, restart server, upgrade/downgrade) rulează acum cu `windowsHide: true` fără ferestre de consolă vizibile
- **PaddleOCR lent pe PDF-uri ANAF** — PDF-urile ANAF cu straturi text ("FORMULAR VALIDAT") sar acum extracția inutilă PaddleOCR, importul fiind aproape instant
- **Zecimale grafic Comparație Ani** — valorile se afișează acum ca numere întregi în etichetele axei și tooltip-uri

---

## v1.4.2 (2026-04-14)

### Corecturi
- **Insigna OCR blocată pe Lite după upgrade** — insigna motorului OCR se actualizează imediat după upgrade la Full sau downgrade la Lite, fără a necesita repornirea serverului
- **Insigna OCR arată Lite la încărcarea paginii** — când detecția PaddleOCR este încă în curs la pornirea serverului, frontend-ul reîncearcă automat până la finalizarea detecției în loc să afișeze insigna greșită

---

## v1.4.1 (2026-04-14)

### Îmbunătățiri UX
- **Tooltip-uri detaliate** pe toate rândurile tabelului de venituri explicând tratamentul fiscal:
  - Rândurile "(reținut la sursă)": explică impozitul final, nu se declară pe D212, contează pentru CASS
  - Rândurile "(credit fiscal)": explică formula creditului fiscal străin (max(0, impozit RO - impozit străin))
  - Rândurile chirii/drepturi IP: explică deducerea forfetară 40% cu exemplu de calcul
- **Câmp impozit dobânzi plătit** — input manual pentru impozit deja reținut pe dobânzi
- **Etichetă "Citește"** — redenumit din "Citește-mă"
- **Grafice ascunse fără date** — toate cele 5 grafice apar doar când există date financiare
- **Notă de subsol tabel venituri** — asterisc (*) cu explicație detaliată deducere 40% pentru chirii/drepturi IP

---

## v1.4.0 (2026-04-14)

### Noi Tipuri de Venituri
- **Venituri din Chirii** — deducere forfetara 40%, impozit 10%/16%, eligibil CASS
- **Drepturi de Proprietate Intelectuală** — deducere forfetara 40%, impozit 10%/16%, eligibil CASS
- **Venituri din Jocuri de Noroc** — impozit final la sursă, input manual, NU intră în CASS
- **Alte Surse de Venituri** — impozit 10%/16%, NU intră în CASS
- **Impozit Dividende SUA Reținut** — input manual pentru credit fiscal 10% convenția RO-SUA
- **Impozit Dividende RO Reținut** — input manual pentru reținere broker

### Corecturi Conformitate Fiscală (ANAF)
- **Cota dividende 2019-2022** — corectată de la 8% la 5% corect
- **Câștiguri capital RO 2019-2022** — corectat de la 1%/3% la 10% flat corect
- **Jocuri noroc excluse din CASS** — conform Art. 174 Cod Fiscal
- **Alte venituri excluse din CASS** — conform Art. 174
- **Tabel venituri: impozit dividende SUA** — nu mai dublează impozitul dividende RO
- **Tabel venituri: "plătit" câștiguri RO** — arată reținerea reală a brokerului
- **Tabel impozite: câștiguri/dividende RO datorate** — arată suma netă dacă brokerul a reținut insuficient

### Îmbunătățiri Panou Principal
- **5 căsuțe rezumat** — Venit Total, Deja Plătit, Impozit pe Venit, CASS, Total D212
- **Grafic venituri cu procente** — legenda și tooltip-urile arată defalcarea %
- **Grafic impozite complet** — segmente impozit chirii, drepturi IP, alte surse
- **Grafic Salariu Minim** — evoluția salariului 2019-2026
- **Layout grafice 2×3** — rândul 1: venituri + impozite, rândul 2: comparație + cursuri + salariu
- **Fonturi grafice mărite** — +2pt pentru legende și etichete axe

### Administrare Date
- **Fișier date manuale** — "Adaugă Date" creează un fișier brut vizibil/editabil în Date Brute
- **Fix câmpuri formular** — dividendele și câștigurile persistă corect după salvare
- **Purgare date manuale** — ștergerea fișierului brut curăță toate câmpurile manuale

### Performanță
- **Detectare PaddleOCR asincronă** — serverul pornește instant, detectarea OCR rulează în fundal

---

## v1.3.2 (2026-04-09)

### Îmbunătățiri
- **Bară de progres pe butonul Upload** — gradient verde se umple stânga-dreapta în timpul procesării; pentru fișiere multiple arată progresul per fișier
- **Bară de progres pe butoanele Upgrade/Downgrade** — arată "Se instalează... X%" cu progres în timp real din utilizarea discului, "Se șterge... X%" cu animație inversă
- **Lățimea butonului blocată** în timpul animațiilor de progres pentru a preveni saltările de layout
- **Fix setup_paddleocr.js** — `stdio: 'inherit'` înlocuit cu pipe explicit pentru a preveni blocarea procesului child când e apelat prin API-ul serverului

---

## v1.3.1 (2026-04-09)

### Corecturi
- **Linkuri Changelog în Ghid** — click pe CHANGELOG.en.md / CHANGELOG.ro.md din Ghid deschide acum o fereastră Changelog suprapusă în loc să navigheze în afară
- **Build portabil: README.ro.md** — README-ul în română lipsea din build-urile portabile
- **Build portabil: Upgrade-to-Full.bat** — acum inclus în ambele build-uri Lite și Full (necesar după downgrade)
- **Build portabil: README generat** — listează Upgrade-to-Full.bat și Downgrade-to-Lite.bat, menționează butonul de upgrade din aplicație

---

## v1.3.0 (2026-04-09)

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

## v1.2.1 (2026-04-08)

### Îmbunătățiri
- **Ștergere multiplă în Date Brute** — căsuțe de selectare pe fiecare rând cu "Selectează tot" și bara "Șterge Selectate"
- Mesaje de confirmare separate pentru ștergere parțială vs. totală
- Suport bilingv (EN/RO) pentru toate textele noi de ștergere multiplă

---

## v1.2.0 (2026-04-08)

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
- PaddlePaddle fixat la 3.0.0 (PaddlePaddle 3.3.1 are crash OneDNN pe Windows)
- `paddlex[ocr]` extra necesar pentru pipeline-ul complet OCR
- Fișierele temporare Multer redenumite cu extensia corectă (.pdf/.jpg) pentru detectarea formatului PaddleOCR
- Tipurile de documente auto-validate ocolesc verificarea generică de calitate OCR
- `GET /api/ocr-status` — endpoint nou pentru detectarea motorului OCR din frontend

---

## v1.1.4 (2026-04-08)

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

## v1.1.3 (2026-04-08)

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

## v1.1.2 (2026-04-07)

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

## v1.1.1 (2026-04-07)

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

## v1.1.0 (2026-03-29)

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
