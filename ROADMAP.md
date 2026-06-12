# Foaie de parcurs (Roadmap)

> 🇬🇧 English version: [`ROADMAP.en.md`](ROADMAP.en.md)

> Un document viu. Pull request-urile sunt binevenite pentru fiecare element. Dacă ceva din această listă pare greșit sau prioritățile tale diferă, deschide un issue sau editează direct acest fișier — contribuitorii mai bine informați ar trebui să-l mențină corect.

Această pagină listează lucrările pe care le cunoaștem, sortate după prioritate. *Maparea* detaliată dintre specificația oficială ANAF D212 și aplicație se află în [`docs/d212-mapping.md`](docs/d212-mapping.md); analiza aprofundată a fiecărui articol din Codul fiscal și a fiecărui paragraf din Instrucțiuni din spatele fiecărui calcul va trăi în pagina „Reguli & Referințe” (vezi P2 mai jos) odată ce va fi livrată.

---

## Cum se citește această listă

| Coloană | Semnificație |
|---|---|
| **Impact** | 🔴 Mare (bani reali / corectitudine) · 🟡 Mediu (calitatea vieții sau conformitate D212) · 🟢 Mic |
| **Efort** | 🟢 Mic (un singur PR, < 1 zi) · 🟡 Mediu (3-7 commit-uri) · 🔴 Mare (multi-PR, design + teste) |
| **Stare** | `deschis` · `preluat de @user` · `în review` · `gata (commit XXXXXXX)` |

## Cum preiei o sarcină

1. Deschide un issue cu titlul `[Roadmap] <titlul sarcinii>` și referențiază secțiunea de mai jos (`#d-1` etc.)
2. Editează acest fișier: schimbă `deschis` în `preluat de @handle-ul-tău, issue #N`
3. Trimite un PR cu implementarea. Include teste acolo unde sarcina atinge `lib/`, `server.js` sau `public/js/app.js`.

## Cum propui un element nou

Deschide un issue cu titlul `[Roadmap proposal] <descriere scurtă>`. Include:

- **De ce** contează (traseu de audit către un articol din Codul fiscal, un scenariu cu bani reali sau un punct dureros de UX)
- **Criterii de acceptare** (cum arată „gata” într-un paragraf)
- O estimare a impactului / efortului
- Opțional: un steag `pierde` dacă blochează ceva ce încerci să faci acum

Mentenanții vor adăuga propunerile acceptate în acest fișier ca parte a îmbinării issue-ului.

## Curs intensiv de inițiere (citește-l o dată înainte de a-ți prelua prima sarcină)

Dacă acesta este primul tău PR, acestea sunt regulile și idiomurile portante din baza de cod:

- **Sursă unică de adevăr pentru constantele fiscale:** [`lib/rates.js`](lib/rates.js) — cursurile de schimb BNR (medii anuale, 2019-2025), `parseNumber`, `toRON`, `detectCurrency`. Nu le duplica în altă parte; importă-le.
- **Adevărul de bază al specificației D212:** [`docs/anaf/d212-2025/`](docs/anaf/d212-2025/) — XSD-ul oficial, regulile schematron, structura tehnică și PDF-ul cu instrucțiuni de completare. Fiecare afirmație din `docs/d212-mapping.md` citează un paragraf de aici. Dacă apare o întrebare de reglementare, acest folder răspunde înaintea oricărui blog terț.
- **Documentul de mapare este literă de lege:** [`docs/d212-mapping.md`](docs/d212-mapping.md) — citește § 1-5 în întregime înainte de a modifica orice calcul. Mapează fiecare cod-BT din XSD către câmpul corespunzător din aplicație.
- **Singura funcție mare de calcul:** [`public/js/app.js: computeYearData`](public/js/app.js) (în jurul liniilor 580-1020). Toată matematica fiscală trece prin aici. Dacă schimbi o formulă, schimb-o aici mai întâi.
- **Testele sunt `node:test`, zero dependențe:** `npm test`. Adaugă un test pentru fiecare modificare de formulă sau parser. Fixturile sintetice trăiesc în [`test/fixtures/`](test/fixtures/).
- **i18n trebuie să rămână verde:** `npm run check-i18n` după orice modificare de UI. Toate textele vizibile pentru utilizator au chei RO + EN.
- **Build-ul portabil este în aval de sursă:** orice modificare de sursă trebuie oglindită în `../D212TaxHelper-Portable-Full/app/` pentru ca varianta portabilă să o preia. (Facem asta manual deocamdată; vezi [sarcina skill P4](#p4) pentru o automatizare viitoare.)
- **Capcane descoperite pe calea grea:**
  - Limita de cuvânt regex `\b` **nu** tratează diacriticele românești (`î`, `ă`, `ș`) drept caractere de cuvânt în JavaScript fără steagul `/u`. Folosește `(?:^|\s)` în loc de `\b` înaintea unor astfel de caractere. Vezi commit-ul `03e467a` pentru remediere.
  - `Math.max(0, owed - paid)` ascunde scenariile de reținere în exces. Folosește diferențe cu semn când scoți la suprafață rambursările. Vezi commit-ul `65cdcaa`.
  - Pierderile românești din câștiguri de capital pot compensa doar câștiguri „de aceeași natură” (Cod fiscal art. 119). Pierderi RO → câștiguri RO; pierderi străine → câștiguri străine. Nu le amesteca.

---

## 🚀 Livrate recent (de la v1.5.x)

Sunt documentate pentru context — NU sunt în așteptare. Vezi `docs/d212-mapping.md` pentru imaginea de conformitate la zi.

| Ce | Commit | De ce contează |
|---|---|---|
| BT Trade adăugat în lista brokerilor români | `bc16d66` | Cerere reală de la un utilizator cu cont BT Trade |
| Suport venituri România EUR/USD (dividende, dobânzi, câștiguri de capital) | `52a2908` | XTB și brokeri similari pot raporta venituri în oricare dintre cele trei monede |
| Parsere rapoarte XTB — multi-rând, multi-monedă | `6e9ff82` | Vechiul parser capta doar primul rând de țară; utilizatorii cu mai multe țări (ex. Irlanda + USA) pierdeau date în tăcere |
| Câștigurile de capital folosesc `net = max(0, gain - loss)` per coș lung/scurt | `c501d3c` | Scoate corect la suprafață pierderile reportabile din anul curent |
| **Detectarea rambursării** — reținere în exces de către brokerul român | `65cdcaa` | 🔴 Bani reali. Eșantionul din 2025 al utilizatorului avea ~1.644 RON rambursabili, ascunși anterior în spatele lui `Math.max(0, ...)` |
| **Pierderile de capital din anii precedenți aplicate la impozitul curent** (D212 Rd.5-6) | `255dcca` | 🔴 Bani reali. `yd.priorLosses` era colectat dar niciodată folosit în calcul. Implementează formula oficială `min(Rd.5, 0.70 × Rd.3)` din Instr. 7.3.3 |
| Avertisment import / suprascriere manuală cu dialog de diferențe alăturate | `46b9705` | Previne pierderea accidentală de date la reimportare |
| Fixturi PDF XTB anonimizate + 35 teste unitare/e2e | `7c45c60` + `03e467a` | Prima suită de teste din proiect. `node:test`, zero dependențe noi |
| Document cuprinzător de mapare D212 | `c1f46e3` + `29a5609` | Sursă unică de adevăr pentru ce face aplicația vs. ce așteaptă ANAF |
| Documentele oficiale de referință ANAF în repo (`docs/anaf/d212-2025/`) | `a5c33f7` | XSD, reguli schematron, PDF instrucțiuni — versionate, comparabile la viitoarele lansări ANAF |

---

## 📋 Următoarele — lacune de conformitate D212

Numerotate să corespundă cu [`docs/d212-mapping.md` § 9](docs/d212-mapping.md#9-gap-analysis--recommendations).

### D-3 — Grupare per-țară, per-categorie la generarea cap14 🟡 Mediu · 🟡 Mediu · `deschis` <a id="d-3"></a>

ANAF așteaptă un rând `cap14` per (țară × categorie de venit). Astăzi îngrămădim totul sub „US” în calcul atunci când utilizatorul are mai multe surse externe.

**Fișiere de atins**
- `public/index.html` — formularul „Adăugă Date”, fieldset-ul din jurul intrărilor de venit extern
- `public/js/app.js` — `populateForm()` (~linia 2370), `handleDataSubmit()` (~linia 2540), `computeYearData()` (~linia 580)
- `lib/rates.js` — ar putea avea nevoie de un mic helper pentru validarea codurilor de țară ISO2
- `public/locales/{ro,en}.json` — etichete pentru noul dropdown
- `test/` — adaugă teste unitare pentru agregarea multi-țară în `computeYearData`

**Referințe oficiale**
- XSD: `docs/anaf/d212-2025/D212.xsd` liniile 1164-1259 — definiția tipului complex `cap14` (17 atribute)
- Coduri BT: `den_stat` (BT-05001), `str_stat_realiz_v` (BT-05002 — ISO2 obligatoriu precum `US`, `IE`, `DE`), `str_categ_venit` (BT-05004 — vezi D-4)
- Instrucțiuni: `docs/anaf/d212-2025/Instructiuni_D212_OMF_2736_2025.pdf` § 39 și următoarele

**Forma de date sugerată** (înlocuiește actualele câmpuri plate `yd.usGains`, `yd.fidelityDividends`, …)
```js
yd.foreignIncome = [
  { country: 'US', categCode: '2012', currency: 'USD', grossAmount: ..., deductible: ..., taxPaidAbroad: ... },
  { country: 'US', categCode: '2018', currency: 'USD', grossAmount: ..., taxPaidAbroad: ... },
  { country: 'DE', categCode: '2018', currency: 'EUR', grossAmount: ..., taxPaidAbroad: ... },
];
```
Păstrează câmpurile plate vechi ca rezervă în timpul tranziției (parserele încă le produc).

**Capcane**
- Codurile de țară ISO2 au 2 caractere (`C2Type` în XSD). Nu folosi `RO` (sursa românească aparține de cap11, nu cap14).
- Câmpul `dubla_impunere` (BT-05005) valoarea `1` = metoda creditării, `2` = metoda scutirii. Tratatul cu SUA folosește creditarea; implicit este `1`.

**Acceptare**
- Un utilizator cu dividende US + dividende UE vede două rânduri pe „Adăugă Date”.
- `computeYearData` le agregă separat în înregistrări de tip `cap14`.
- Teste: cel puțin 3 cazuri — o singură țară o singură categorie, o singură țară multi-categorie, multi-țară.

### D-4 — Emiterea codurilor `str_categ_venit` dincolo de 2012/2018 🟡 Mediu · 🟢 Mic · `deschis` <a id="d-4"></a>

Parserele codifică fix `2012` (câștiguri de capital) și `2018` (dividende). Pentru dobânzi, redevențe etc. niciun cod nu este setat. Necesar pentru D-7 (export XML).

**Fișiere de atins**
- `lib/rates.js` — adaugă o constantă `CATEG_VENIT_LABELS` care exportă `{ '2012': 'Câștiguri din transferul titlurilor de valoare', '2018': 'Venituri din dividende', ... }`
- `lib/parsers/xtb.js` — la emiterea unei înregistrări de tip cap14, setează codul corect
- `server.js: parseForm1042S, parseFidelityStatement, parseMSStatement` — etichetează cu codurile corecte
- `test/rates.test.js` — verifică funcționarea căutării etichetei
- `test/parsers-xtb.test.js` — verifică faptul că fiecare parser setează codul corect

**Referințe oficiale**
- Lista albă de coduri: `docs/anaf/d212-2025/codes/d212-codes.sch` liniile 457-460 (19 coduri valide)
- Etichete: `docs/anaf/d212-2025/d212_docTehnica_v1.0.8_17042026.xls`, foaia „Nomenclator_venituri_STR” — extrage o singură dată în constanta JS (nu încărca xlsx-ul în timpul execuției)

**Decodate până acum** (din comentariile existente din `server.js` și `docs/d212-mapping.md`)
- `2012` — Câștiguri din transferul titlurilor de valoare
- `2018` — Venituri din dividende — dubla impunere
- Celelalte 17 coduri trebuie decodate din XLS

**Abordare sugerată**
1. Deschide `d212_docTehnica_v1.0.8_17042026.xls` în LibreOffice / Excel, localizează foaia Nomenclator_venituri_STR
2. Transcrie manual cele 19 coduri + etichetele românești în `lib/rates.js`
3. Rulează `npm test` — testele existente vor surprinde intrările lipsă printr-o nouă verificare `CATEG_VENIT_LABELS`

**Capcane**
- Codurile sunt șiruri de 4 cifre (`N4Type`), nu numere întregi. Nu elimina zerourile din față.
- Eticheta este obligatorie pentru `den_categ_venit` (BT-05003), care este `C500Type` în XSD.

### D-5 — Separarea reportării pierderilor: străine vs. RO 🟡 Mediu · 🟡 Mediu · `deschis` <a id="d-5"></a>

Conform Cod fiscal art. 119 și Instr. 7.3.3: pierderile pot compensa doar câștiguri „de aceeași natură”. Astăzi `yd.priorLosses` este un singur număr aplicat doar câștigurilor RO. Pierderile străine au nevoie de propriul lor fond.

**Fișiere de atins**
- `public/index.html` — împarte intrarea unică „Pierderi reportate” în două: RO și străine
- `public/js/app.js: computeYearData` — găsește secțiunea din jurul lui `priorLossesAvailable` (caută comentariul „D212 Rd.5-6” din commit-ul `255dcca`) și aplică fiecare fond propriului coș de câștiguri
- `public/locales/{ro,en}.json` — adaugă etichete: „Pierderi reportate (broker RO)” / „Pierderi reportate (străinătate)”
- `test/` — adaugă un test în care ambele fonduri sunt prezente și verifică aplicarea lor independentă

**Referințe oficiale**
- Cod fiscal **art. 119 alin. (2)**: „Pierderile nete anuale din transferul titlurilor de valoare ... reportate în următorii 7 ani fiscali consecutivi” + regula „de aceeași natură”
- Instrucțiuni: `Instructiuni_D212_OMF_2736_2025.pdf` § 7.3.3 (sursă RO, pagina 17) și paragraful echivalent pentru cap14 (sursă străină — caută „pierdere fiscală compensată” în `Instructiuni_D212_OMF_2736_2025.pdf` după pagina 17)
- XSD: `cap11.pierdere_precedenta` (BT-03022) și `cap14.str_pierdere_precedenta` (BT-05012) sunt atribute separate

**Cale de migrare**
- Câmpul existent `yd.priorLosses` rămâne ca `yd.priorLossesRO` (redenumire + adaugă cititor de compatibilitate)
- Adaugă noul `yd.priorLossesForeign`
- Actualizează listele albe `manualFields` din `server.js: app.put('/api/data/:year')` (~liniile 306, 396)

**Acceptare**
- Detaliile de venit arată ambele fonduri și sumele aplicate; ambele au afișaje separate de „rămas pentru reportare”.
- Test care confirmă că priorLossesRO NU compensează câștigurile US, și invers.

### D-6 — Venituri din investiții de sursă românească declarate pe cap11 🔴 Mare · 🟡 Mediu · `gata — partea de câștiguri de capital` <a id="d-6"></a>

XTB/Tradeville/BT Trade rețin impozit la sursă („impozit final”), dar venitul tot contează la baza CASS și trebuie declarat pe cap11 (cu `impozit_retinut` setat). Astăzi aplicația sare complet peste cap11 pentru acești utilizatori, ceea ce înseamnă că **baza CASS poate fi subdeclarată** pentru utilizatorii care au doar venituri de la broker RO.

**Fișiere de atins**
- `public/js/app.js: computeYearData` — deja calculează numerele corecte (fluxul de rambursare le folosește). Adaugă o structură de ieșire `cap11Rows[]` care oglindește forma per-rând a lui `cap14`.
- `server.js` — când va fi livrat D-7, emitorul XML va citi `cap11Rows`.
- `docs/d212-mapping.md` — comută lacuna #6 la „în progres” apoi „gata” când aterizează.

**Referințe oficiale**
- XSD: elementul `cap11`, liniile 849-995 din `D212.xsd`. 28 de atribute; cele relevante pentru venitul din investiții:
  - `categ_venit` (BT-03004) — cod din Nomenclator_venituri_RO (listă diferită de str)
  - `venit_brut` (BT-03018) — Rd.1
  - `pierdere_compensata` (BT-03023) — Rd.6 (folosește formula deja implementată pentru `data.priorLossesApplied`)
  - `impozit11` (BT-03026) — Rd.8 impozit calculat (1%/3% × Rd.7)
  - `impozit_retinut` (BT-03027) — Rd.9 reținere broker (deja în `data.roPortTaxWithheld`)
- Instrucțiuni: `Instructiuni_D212_OMF_2736_2025.pdf` § 7 (subsecțiunea 1.5 — transferul titlurilor de valoare) pentru câștiguri de capital; verifică subsecțiunile anterioare pentru categoriile de dividende/dobânzi
- Coduri Nomenclator pentru cap11: caută în `d212_docTehnica_v1.0.8_17042026.xls` foaia „Nomenclator_venituri_RO” (atenție: RO nu STR)

**Capcane**
- Formularea „impozit final” în vorbirea de zi cu zi NU înseamnă „sari peste D212”. Înseamnă că reținerea brokerului este cota finală de impozit — utilizatorul tot trebuie să o declare pe cap11 în scopuri CASS (și pentru a cere regularizarea dacă e cazul, ceea ce deja facem prin fluxul de rambursare).

**Acceptare**
- Un utilizator cu venituri doar de la XTB vede un array `cap11Rows[]` în datele calculate cu valorile corecte `venit_brut`, `pierdere_compensata`, `impozit11`, `impozit_retinut`.
- Exportul D-7 îl folosește pentru a emite un element cap11 valid.

**Stare (livrat)**
- ✅ `lib/d212-cap11.js: buildCap11Rows({...})` — helper pur, returnează 0-sau-1 rând (unicitatea Schematron BR-D212-0085 a lui `categ_venit=1012`).
- ✅ `public/js/app.js: computeYearData` — oglindă inline, populează `data.cap11Rows`.
- ✅ `public/index.html` + render — secțiune nouă „D212 Cap. I §1.1 — cap11” pe tab-ul Calcul Impozite afișează Rd.1..Rd.9 când rândul este nevid.
- ✅ Teste: 8 cazuri în `test/d212-cap11.test.js` acoperind gol / doar-câștig / pierdere-anterioară / pierdere-cross-coș / reținere-în-exces / doar-pierdere / doar-pierdere-anterioară / formatul categ_venit.
- Dividendele + dobânzile cu „impozit final” rămân deliberat în afara cap11 — nu sunt în Nomenclator_venituri_RO pentru persoane fizice; alimentează doar baza CASS (Cap. II), deja acoperită.

### D-7 — Export XML D212 🔴 Mare · 🔴 Mare · `gata — nivel schelet` <a id="d-7"></a>

Emite un XML parțial conform cu `docs/anaf/d212-2025/D212.xsd` pe care utilizatorul îl poate importa direct în instrumentul PDF oficial ANAF.

**Fișiere de atins**
- `public/js/app.js` — nouă funcție `exportD212Xml(selectedYear)` care consumă `cap11Rows[]` + `cap14Rows[]` calculate din D-6 și D-3
- `public/index.html` — nou buton „Exportă D212 XML” pe pagina Calcul Impozite
- `lib/d212-xml-builder.js` (NOU) — mic modul care produce un șir XML; nicio bibliotecă XML externă necesară (schema are atribute simple)
- `lib/d212-validator.js` (NOU, opțional dar recomandat) — rulează regulile schematron din `docs/anaf/d212-2025/business/*.sch` împotriva XML-ului construit și raportează erorile inline înainte de descărcare
- `test/d212-xml-builder.test.js` (NOU) — verifică împotriva unui XML așteptat de referință

**Referințe oficiale**
- XSD complet la `docs/anaf/d212-2025/D212.xsd`
- Namespace: `xmlns="mfp:anaf:dgti:d212:declaratie:v11"`
- Atribute obligatorii ale elementului rădăcină (BR-D212-0006, 0005): `an_r="2026"`, `luna_r="12"` pentru anul fiscal 2025
- Steagurile bifa trebuie să corespundă prezenței capitolelor: `bifa121=1 ↔ cap14 există` (BR-D212-0009), `bifa111=1 ↔ cap11 există` (BR-D212-0007), etc.
- `totalPlata_A` (BT-00004) = suma cifrelor lui `cif` (BR-D212-0004) — dar cum nu colectăm `cif`, lasă gol și permite utilizatorului să-l completeze
- Reguli de validare: `docs/anaf/d212-2025/business/d212-business*.sch` — 76 de reguli în total

**Dependențe**
- D-3 (grupare per-țară) — necesară pentru a produce un rând cap14 per (țară, categorie)
- D-4 (coduri categ_venit) — necesară pentru a seta atributele corecte `str_categ_venit` / `categ_venit`
- D-6 (emitere cap11) — necesară dacă utilizatorul are venituri de la broker român
- D-8 (date personale, opțional) — fără ea, utilizatorul primește un XML „schelet” pe care încă trebuie să-l completeze parțial

**Capcane**
- Schema ANAF folosește **doar RON întreg** (fără zecimale) — `N15Type` = până la 15 cifre, fără punct zecimal. Folosește `Math.round()` pe fiecare atribut numeric.
- Formatul datei este `ZZ/LL/AAAA` (`D10Type`), nu ISO `AAAA-LL-ZZ`. Bare oblice, nu cratime.
- Atributele goale ar trebui **omise** din XML, nu setate la șiruri goale — validatorul tratează `""` diferit de absent.
- XML-ul trebuie validat atât împotriva XSD-ului (structură) CÂT ȘI a regulilor schematron (consistență între câmpuri). Validarea doar-XSD este necesară dar nu suficientă.

**Acceptare**
- Construiește un XML eșantion pentru datele din 2025 ale utilizatorului; importă-l în instrumentul PDF oficial ANAF fără erori.
- Toate cele 76 de reguli BR-D212-* trec (acolo unde se aplică datelor).
- Utilizatorul completează doar datele personale pe partea ANAF și semnează.

**Stare (livrat — nivel schelet)**
- ✅ `lib/d212-xml-builder.js: buildD212Xml({...})` — emite rădăcina `<d212>` cu toate cele 13 steaguri `bifa*` obligatorii (setate automat în funcție de prezența capitolelor), date personale placeholder cu un comentariu TODO în față, și un element `<cap11>` / `<cap14>` autoînchis per rând.
- ✅ `lib/d212-cap14.js: buildCap14Rows(data)` — helper pur care produce 0-2 rânduri cap14 (dividende US categ_venit=2018, câștiguri de capital US categ_venit=2012). Testat.
- ✅ `server.js` — POST `/api/d212-xml/:year` împachetează `cap11Rows + cap14Rows` precalculate de client în XML; Content-Disposition declanșează o descărcare în browser ca `D212_{year}_skeleton.xml`.
- ✅ `public/js/app.js: exportD212Xml(year)` + buton pe tab-ul Calcul Impozite.
- ✅ Teste: 5 cap14 + 9 cazuri xml-builder incluzând escaparea caracterelor speciale, multi-rând, completarea datelor personale, suma cifrelor totalPlata_A.

**Limitări cunoscute (iterații viitoare):**
- Atributele de date personale sunt emise ca placeholder-e (NUME / PRENUME / 0000000000000) — utilizatorul TREBUIE să le înlocuiască în instrumentul ANAF. D-8 va adăuga un formular local opțional.
- Gruparea per-țară (D-3) nu este încă conectată: toate veniturile externe merg sub `str_stat_realiz_v="US"`. Utilizatorii multi-jurisdicție (ex. dividende UE prin XTB) trebuie să împartă rândul manual deocamdată.
- Re-validarea schematron completă înainte de descărcare nu este conectată (ar necesita xslt2 sau o implementare JS de schematron). Importul XML-ului generat în instrumentul oficial ANAF scoate la suprafață orice probleme la momentul validării.

### D-8 — Pas opțional pentru date personale 🟢 Mic · 🟢 Mic · `deschis` <a id="d-8"></a>

În mod deliberat nu colectăm CNP / nume complet / IBAN. Pentru a face D-7 cu adevărat cap-coadă, adaugă un tab *opțional* unde utilizatorul le introduce.

**Fișiere de atins**
- `public/index.html` — nou tab „Date personale (opțional)” sau nou fieldset pe tab-ul existent Adăugă Date
- `db.js` — nou tabel `personal_data` (un singur rând) sau stochează în `year_data` existent (câmpuri independente de an)
- `server.js` — noi endpoint-uri PUT/GET `/api/personal-data`
- `public/js/app.js: exportD212Xml` — include datele personale doar dacă sunt completate

**Referințe oficiale**
- Atribute rădăcină XSD: `nume_c` (BT-00023), `initiala_c` (BT-00024), `prenume_c` (BT-00025), `cif` (BT-00030), `cont_bancar` (BT-00035)
- Reguli de validare: BR-D212-0001 (format CNP), BR-D212-0004 (`totalPlata_A` = suma cifrelor CIF), BR-D212-0012 (format IBAN RO + sumă de control mod 97)

**Capcane**
- Tratează tabelul de date personale ca fiind **sensibil**: nu îl loga, nu îl include în niciun răspuns API în mod implicit și adaugă-l la `.gitignore` (DB-ul este deja gitignored, dar conținutul tabelului ar trebui marcat clar).
- Suma de control IBAN RO: `Modulus 97` este bine documentat. Implementarea proprie este în regulă; nu aduce o dependență.
- Fă comutatorul foarte vizibil — întreaga postură de confidențialitate a aplicației (fără date personale) depinde de opt-in.

**Acceptare**
- Un comutator clar de opt-in.
- Datele trăiesc în baza de date SQLite locală.
- Exporturile (XML D-7, zip de audit P3) le includ doar dacă utilizatorul le-a completat.
- README actualizat pentru a clarifica opt-in-ul.

---

## 📋 Următoarele — Platformă & DX

Numerotate să corespundă cu [`docs/d212-mapping.md` § 10](docs/d212-mapping.md#10-platform--dx-gaps-non-d212-but-tracked-here).

### P1 — Splash de încărcare înainte de dashboard 🟡 Mediu · 🟢 Mic · `deschis` <a id="p1"></a>

Browserul se deschide la o pagină goală timp de câteva secunde cât pornește Node. Adaugă un indicator vizual rapid.

**Fișiere de atins**
- `public/index.html` — adaugă un `<div id="boot-overlay">` inline la începutul lui `<body>` cu un spinner CSS; bootstrap-ul SPA ar trebui să-l elimine din `loadAllData().finally(() => removeOverlay())`
- `public/css/styles.css` — `.boot-overlay { position: fixed; inset: 0; z-index: 9999; ... }` plus un `@keyframes spin` pentru indicator
- `public/js/app.js` — în secvența de inițializare existentă (caută `loadAllData()` în jurul liniei 444), apelează `document.getElementById('boot-overlay')?.remove()` odată ce datele sunt gata
- `Start.bat` (sursă + portabil) — deja deschide URL-ul prea devreme (sleep 2 sec). Mărește la `timeout /t 4 /nobreak` ca splash-ul să apuce să se deseneze înainte ca Express să fie gata. Opțional.

**Capcane**
- Păstrează overlay-ul 100% CSS — fără fonturi externe, fără dependențe SVG, fără framework JS. Toată ideea este să arăți *ceva* înainte ca SPA-ul să se încarce.
- Nu folosi imagini de fundal care trebuie aduse de pe disc — codifică spinner-ul inline ca borduri CSS + rotație.
- Testează în modul întunecat (`data-theme="dark"` pe `<html>`). Overlay-ul trebuie să se potrivească.

**Acceptare**
- Zero dependențe noi.
- Funcționează atât în modul portabil (`Start.bat`) cât și dev (`npm start`).
- Utilizatorul nu vede niciodată o pagină albă goală după ce apasă Start.bat.

### P2 — Pagina „Reguli & Referințe” pentru contabili 🔴 Mare · 🟡 Mediu · `deschis` (deblocat de P5 ✅) <a id="p2"></a>

O singură pagină care permite unui contabil fiscal român să verifice fiecare calcul citind un singur document. Ieșirea este un document de referință destinat publicului — proiectează-l așa cum s-ar aștepta un consultant fiscal român: citate întâi, formule al doilea, narațiune al treilea.

**Fișiere de atins**
- `public/index.html` — nou tab de nivel superior „Reguli & Referințe” alături de Dashboard / Detalii Venit / etc.
- `public/js/app.js` — nou `renderRulesPage()` care construiește conținutul dintr-o sursă de date structurată (nu codifica HTML; viitorii contribuitori vor edita date, nu markup)
- `lib/rules-catalog.js` (NOU) — sursă unică de adevăr: un array de obiecte-regulă cu `{ category, lawArticle, instructionParagraph, formula, exampleInput, exampleOutput, codeRef: 'public/js/app.js:LINIE' }`
- `public/locales/{ro,en}.json` — etichete pentru pagină, dar definițiile regulilor rămân în `rules-catalog.js` ca să poată fi doar-în-română (termeni juridici)
- `.github/ISSUE_TEMPLATE/missing-rule.md` (NOU) — șablon de issue pentru ca contabilii să trimită o regulă pe care am omis-o

**Structură** (un card per regulă)
```
🇷🇴 Dividende din străinătate (cap14, str_categ_venit=2018)
  Cota de impozit: 8% (2023-2024), 10% (2025), 16% (2026+)
  Cod fiscal: art. 91 alin. (2)
  Instrucțiuni D212: § 39.6.10-11
  Formula: impozit_RO = grossRON × cota
           credit_fiscal = min(impozit_RO, impozit_platit_strainatate)
           dif_de_plata = max(0, impozit_RO - credit_fiscal)
  Implementare: public/js/app.js: computeYearData() (linia ~789)
  Verificat ultima dată împotriva: Instructiuni_D212_OMF_2736_2025.pdf
  [Trimite o corecție →]
```

**Reguli inițiale de populat** (set minim viabil, ~15 intrări)
- Dividende US (metoda creditării prin tratat) — cap14 cu str_categ_venit=2018
- Câștiguri de capital US — cap14 cu str_categ_venit=2012
- Dividende de sursă românească (impozit final la sursă, dar luate în calcul la baza CASS)
- Câștiguri de capital de sursă românească (1% lung, 3% scurt pentru 2023-2025; 3%/6% din 2026)
- Dobânzi românești (10% reținut la sursă pentru 2023-2025; 16% din 2026)
- Dobânzi plătite de entitate RO la obligațiuni emise în străinătate (cap11, tratament special)
- BIK din RSU / Stock Awards — deducere din baza de cost a câștigurilor de capital US
- Reportarea pierderilor din anii precedenți (Rd.5-6, regula maximă 70%)
- Reportarea pierderilor din anul curent — se adaugă la fondul anului următor
- Praguri CASS pentru venitul din investiții: 6 SM / 12 SM / 24 SM (NU 60 SM)
- Compoziția bazei CASS (Instr. § 51): dividende NETE de impozit, dobânzi NETE, câștiguri de capital ca câștig net
- Curs de schimb BNR (medie anuală per BNR) — când se aplică
- Venit din chirii — 10% pe net (deducere forfetară 40%)
- Venit din redevențe — 10% pe net (deducere forfetară 40%)
- Venit din jocuri de noroc — impozit final la sursă, declarat pentru completitudine

**Referințe oficiale**
- Toate în arbore sub [`docs/anaf/d212-2025/`](docs/anaf/d212-2025/)
- Articole din Codul fiscal de citat: 91 (dividende), 94-97 (câștiguri de capital), 98-99 (dobânzi), 110 (jocuri de noroc), 119 (reportarea pierderilor), 154 + 174^1 (scutiri și tranșe CASS)

**Capcane**
- Nu parafraza legea în caseta de formulă — citeaz-o. Contabilii români vor avea încredere într-un citat exact mai mult decât într-o traducere.
- Fiecare regulă trebuie să citeze atât articolul din Codul fiscal CÂT ȘI paragraful din instrucțiunile D212. Discrepanțele dintre ele se întâmplă și sunt valoroase de scos la suprafață.
- Include un marcaj temporal „Verificat ultima dată împotriva” ca o regulă învechită să fie ușor de observat.

**Acceptare**
- Fiecare formulă din `computeYearData` are o intrare corespunzătoare în `rules-catalog.js`.
- Un contabil român citește pagina de sus în jos și identifică cel puțin o regulă lipsă pe care ar trebui să o adăugăm (succes = fluxul de lucru funcționează).
- Șablonul de issue `[Roadmap proposal]` referențiază pagina de reguli.

### P3 — Export zip pachet de audit ANAF 🔴 Mare · 🟡 Mediu · `deschis` (depinde de P2) <a id="p3"></a>

Pachet defensiv pentru solicitările ANAF: un zip conținând fiecare document justificativ astfel încât o terță parte să poată reproduce fiecare număr de pe D212-ul utilizatorului.

**Fișiere de atins**
- `public/js/app.js` — nou buton „Exportă pachet control ANAF” pe Dashboard
- `server.js` — nou endpoint `POST /api/export/audit-pack/:year` care construiește zip-ul pe partea de server (zipping-ul pe partea de browser ar necesita dependența JSZip; pe partea de server este mai simplu)
- `lib/audit-pack-builder.js` (NOU) — produce stream-ul zip
- `package.json` — adaugă `archiver` ca dependență de runtime (cea mai populară bibliotecă Node de zip, MIT, ~50 KB)
- `public/locales/{ro,en}.json` — etichete de buton și conținutul README (parametrizat)
- `test/audit-pack-builder.test.js` (NOU) — verifică structura, prezența fișierelor și că zip-ul este reproductibil (aceleași intrări → zip identic la nivel de octet)

**Conținutul zip-ului** (tipar de nume fișier: `D212-audit-pack-{year}-{AAAALLZZ}.zip`)
```
README.md                       ← explică conținutul și cum o terță parte poate re-verifica
methodology.html                ← captură a paginii de reguli P2 randată pentru anul respectiv
year-data.json                  ← valori complete calculate exportate din computeYearData
broker-statements-raw-text/
  xtb_dividends_2025_raw.txt    ← din data/*_raw.txt
  xtb_portfolio_2025_raw.txt
  ...
parsed-data/
  xtb-dividends.json
  xtb-portfolio.json
  ...
exchange-rates.json             ← cursurile BNR folosite (an + monedă + valoare)
generated-d212.xml              ← din D-7 (dacă livrat) — ce s-a depus efectiv
calculation-trace.txt           ← per-categorie: formulă → intrări → ieșire, linie cu linie
```

**Capcane**
- PDF-urile brute încărcate NU sunt stocate astăzi (sunt șterse după parsare — vezi `server.js` în jurul liniei 692). Pentru a suporta includerea originalelor, fie începe să reții o copie sub `data/raw-pdfs/{year}/{filename}` (ia în calcul spațiul pe disc), fie include doar textul extras + JSON-ul parsat. Implicit doar-text deocamdată.
- Pachetul de audit conține date potențial sensibile — generează-l local și nu îl trimite niciodată către vreun serviciu extern.
- Folosește o ordonare deterministă a fișierelor în interiorul zip-ului astfel încât două rulări ale acelorași date să producă arhive identice la nivel de octet — asta permite utilizatorului să-și verifice propriul pachet cu o sumă de control.

**Acceptare**
- Deschiderea zip-ului și urmarea README-ului inclus permite unei terțe părți (un contabil, un inspector ANAF) să reproducă fiecare număr de pe D212-ul utilizatorului.
- Zip-ul are < 10 MB pentru un an tipic (doar-text).
- Un test verifică faptul că conținutul zip-ului corespunde unui manifest de referință.

### P4 — Skill Claude/AI pentru motorul fiscal de bază 🟢 Mic · 🟢 Mic · `deschis` <a id="p4"></a>

Limitează modificările AI la căile de mare încredere (calcul fiscal, parsere) și departe de căile de încredere scăzută (stilizare UI, build portabil, schemă db).

**Fișiere de atins**
- `.github/skills/anaf-tax-engine/SKILL.md` (NOU) — frontmatter + corp
- (Opțional) `.github/skills/anaf-tax-engine/examples/` — câteva exemple lucrate (patch-uri înainte/după care ar trebui să fie în interiorul scopului)

**Frontmatter skill** (sugerat)
```yaml
---
name: anaf-tax-engine
description: Modificări limitate la nucleul de calcul fiscal D212. Folosește când repari formule în computeYearData, parserele din lib/parsers/, sau modulul rates. NU folosi pentru restilizare UI sau modificări de build portabil.
allowed_paths:
  - lib/rates.js
  - lib/parsers/**
  - public/js/app.js  # doar computeYearData și helperele sale
  - test/**
  - docs/d212-mapping.md
  - docs/anaf/**  # doar-citire
forbidden_paths:
  - public/css/**
  - public/index.html  # cu excepția conectării unei noi valori calculate în UI
  - build-portable.js
  - setup_paddleocr.js
  - db.js  # modificările de schemă necesită review uman explicit
  - server.js  # majoritatea modificărilor aparțin altundeva; permite doar când un parser depinde de el
required_checks:
  - npm test
  - npm run check-i18n
  - node --check server.js
---
```

**Corpul skill-ului** (conținut cheie)
- Indicatori către fișierele portante (vezi „Curs intensiv de inițiere” mai sus)
- Lista „capcane descoperite pe calea grea” (regex `\bî`, `Math.max(0)`, pierderi „de aceeași natură”)
- Invocări concrete: „pentru a repara o formulă, editează `computeYearData`, adaugă un test în `test/`, apoi actualizează `docs/d212-mapping.md` cu citatul”
- Acțiuni interzise: „nu redenumi câmpurile exportate existente fără un alias de depreciere”; „nu introduce dependențe noi de runtime”

**Capcane**
- Skill-ul este consultativ — nu impune. Un om care face review tot trebuie să verifice că nu au fost atinse căile interzise.
- Păstrează skill-ul mic. Skill-urile umflate sunt ignorate. Țintește < 200 de linii.

**Acceptare**
- Rularea unei sesiuni de codare AI cu skill-ul încărcat menține modificările propuse în interiorul căilor listate.
- `npm test` trece după sesiune.
- Un recenzent poate rula `git diff --name-only` și confirma că doar căile permise s-au schimbat.

---

## 💡 Idei (deschise pentru discuție)

Acestea nu sunt planificate formal. Deschide un issue `[Roadmap proposal]` dacă vrei să promovezi una la **Următoarele**.

- **Validatoare schematron în JS.** Implementează un subset al regulilor `BR-D212-*` din `docs/anaf/d212-2025/business/*.sch` astfel încât utilizatorul să primească o listă clară de avertismente înainte de exportul D-7. Efort mediu.
- **Detectarea bonificației.** În majoritatea anilor guvernul emite o ordonanță pentru un discount de plată anticipată (ex. 3% reducere dacă plătești până pe 25.05). Aplicația ignoră asta în prezent. Când apare o OUG, adaugă un steag.
- **Arbore de decizie pentru excepții CHEN.** Unii utilizatori se califică pentru excepții (scutire CASS pentru persoane cu handicap, scutire prin tratat de dublă impunere etc.). Astăzi acestea sunt suprascrieri silențioase. Un mic dialog care întreabă „ți se aplică vreuna dintre acestea?” cu emiterea codului corect ar ajuta.
- **Suport multi-utilizator / multi-CNP.** Astăzi aplicația presupune o singură persoană fiscală. O familie care o rulează pe un singur calculator ar trebui să bifurce folderele de date. Un dropdown pentru „profil activ” + SQLite per-profil ar ajuta.
- **Comparator pre/post-tratat.** Pentru venitul de sursă US, arată un calcul de impozit „cu tratat” vs „fără tratat” alăturat astfel încât utilizatorul să înțeleagă ce îi cumpără certificatul de rezidență.

---

## ⏳ În curs de desfășurare

Nimic activ în zbor. Ramura activă (`feature/eur-usd-support-and-tests`, după redenumire) are elementele de la „Livrate recent” de mai sus.

---

## 🗂️ Instantaneu de stare

Generat periodic din SQL-ul de urmărire pe care mentenanții îl folosesc intern. Actualizează rulând `npm run roadmap:sync` (TODO: conectează asta — vezi propunerea din discuția legată de P4).

| Tier | Deschis | Gata |
|---|---:|---:|
| Conformitate D212 | 5 (D-3, D-4, D-5, D-6, D-7, D-8 cu excepția a 2 deja gata) | 2 (D-1 rambursare, D-2 pierderi anterioare) |
| Platformă & DX | 4 (P1, P2, P3, P4) | 1 (P5) |
| **Total** | **9** | **3** |
