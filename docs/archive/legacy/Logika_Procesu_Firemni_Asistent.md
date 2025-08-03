# Logika Procesu - Firemní Asistent

## Přehled aplikace

**Firemní-Asistent** je komplexní systém pro evidenci zakázek, správu zaměstnanců a automatizaci fakturace. Aplikace slouží firmám různého zaměření k řízení projektů od zadání až po vystavení faktury.

### Strategické technologické rozhodnutí: GraphQL API

Od samého počátku vývoje je stanoveno, že veškerá komunikace mezi klientskými aplikacemi (desktop, mobil) a serverem bude probíhat výhradně přes **GraphQL API**. Toto rozhodnutí bylo učiněno s ohledem na dlouhodobou vizi produktu, která zahrnuje budoucí integraci **inteligentního AI asistenta**. GraphQL poskytuje nezbytnou rychlost, flexibilitu a efektivitu pro zpracování komplexních dotazů v reálném čase.

Podrobnější informace o této vizi a technickém zdůvodnění naleznete v dokumentu `Vize_AI_Asistent.md`.

---

## Databázová struktura

Detailní technický návrh databázové struktury, včetně definic tabulek, sloupců, datových typů a vztahů (primární a cizí klíče), je popsán v samostatném dokumentu `SCHEMA.md`.
Následuje pouze zjednodušený přehled pro kontext.


### 1. DB Zákazníci/Klienti
**Účel**: Evidence všech zákazníků (fyzické i právnické osoby)

**Klíčová data**:
- Základní identifikace (IČO, DIČ, adresa)
- Kontaktní osoby s poznámkami
- Obchodní informace (typ zákazníka, platební podmínky)
- GDPR souhlasy a datumy
- Historie spolupráce a reference

### 2. DB Zaměstnanci
**Účel**: Evidence všech pracovníků (zaměstnanci + OSVČ)

**Klíčová data**:
- Osobní údaje (jméno, adresa, kontakty)
- Právní forma (zaměstnanec vs. OSVČ)
- Smluvní vztah (typ smlouvy)
- Ohodnocení (hodinová mzda, ceny pracovních úkonů)
- IČO/DIČ pro OSVČ

### 3. DB Materiál
**Účel**: Skladová evidence všech materiálů

**Klíčová data**:
- Identifikace (kód, název, kategorie)
- Skladové údaje (množství, minimální zásoba, umístění)
- Cenové údaje (nákupní/prodejní cena, dodavatel)
- Technické specifikace
- Datum pořízení a expiraci

### 4. DB Cena pracovních úkonů
**Účel**: Ceník služeb přizpůsobitelný podle typu firmy

**Příklad pro grafickou firmu**:
- Lepení grafiky (cena za m²)
- Instalace baneru (3 typy instalace, cena za m²)
- 3D loga (individuální nacenění)
- Potisk oděvu (cena podle velikosti)
- Hodinová sazba pro různé činnosti

### 5. DB Dodavatelé
**Účel**: Evidence všech dodavatelů materiálu

**Klíčová data**:
- Identifikace firmy (IČO, DIČ, sídlo)
- Kontaktní osoby podle rolí (obchod, kvalita, finance)
- Bankovní údaje a platební podmínky
- Hodnocení spolehlivosti

---

## Role a oprávnění uživatelů

### 1. Admin
**Oprávnění**:
- Správa všech uživatelů a jejich rolí
- Konfigurace systému
- Přístup ke všem datům
- Zálohování a údržba

### 2. Majitel firmy
**Oprávnění**:
- Vytváření a správa zakázek
- Přiřazování pracovníků k zakázkám
- Evidence materiálu na zakázkách
- Evidence vlastních pracovních úkonů
- Přehled nákladů a ziskovosti
- Generování reportů
- Komunikace se zaměstnanci
- Schvalování ukončení zakázek

### 3. Zaměstnanec
**Oprávnění**:
- Přístup pouze k přiřazeným zakázkám
- Evidence vlastních pracovních úkonů
- Evidence odpracovaných hodin
- Přehled vlastních výdělků
- Komunikace s majitelem

### 4. OSVČ najatý na práci
**Oprávnění**:
- Přístup pouze k přiřazeným zakázkám
- Evidence vlastních pracovních úkonů
- Evidence odpracovaných hodin
- Přehled vlastních výdělků
- Přístup k fakturačním informacím
- Komunikace s majitelem

---

## Klíčové business procesy

### Proces 1: Vytvoření zakázky

**Krok 1: Inicializace**
- Majitel vytvoří novou zakázku přes formulář
- Vybere zákazníka z DB nebo vytvoří nového
- Zadá základní informace (název, popis, termín, rozpočet)

**Krok 2: Přiřazení zdrojů**
- Přiřadí zaměstnance a/nebo OSVČ k zakázce
- Definuje jejich role na projektu
- Nastaví ohodnocení pro konkrétní zakázku (může být individuální)

**Krok 3: Aktivace**
- Zakázka je označena jako "aktivní"
- Pracovníci získají přístup k evidenci práce
- Spustí se automatické sledování nákladů

### Proces 2: Evidence práce (Zaměstnanci/OSVČ)

**Průběžná evidence**:
- Pracovník se přihlásí do zakázky
- Eviduje pracovní úkony s časovými údaji
- Zadává počet odpracovaných hodin
- Může přidávat poznámky k práci

**Validace**:
- Systém kontroluje oprávnění k zakázce
- Ověřuje platnost ceníku pracovních úkonů
- Ukládá timestamp každého záznamu

### Proces 3: Evidence materiálu (Majitel)

**Postup**:
- Majitel průběžně zadává spotřebovaný materiál
- Vybírá z DB materiálu nebo přidává nový
- Zadává množství a cenu
- Systém automaticky odpočítává ze skladu

**Kontroly**:
- Upozornění při poklesu pod minimální zásobu
- Sledování nákladů vs. rozpočet
- Evidence dodavatele pro daný materiál

### Proces 4: Automatické výpočty nákladů (1x za 24h)

**Spouštění**:
- Automatický proces běží každý den ve stanovenou hodinu
- Prochází všechny aktivní zakázky

**Výpočet nákladů**:
- Sečte všechny pracovní úkony (cena × množství)
- Sečte všechny odpracované hodiny (hodinová sazba × hodiny)
- Sečte všechny materiály (nákupní cena × množství)
- Spočítá celkové náklady na zaměstnance/OSVČ

**Výpočet prodejní ceny**:
- Aplikuje marži na materiál
- Aplikuje prodejní sazbu na pracovní úkony
- Spočítá celkovou cenu pro zákazníka

**Reporty**:
- Aktualizuje přehled ziskovosti
- Generuje varování při překročení rozpočtu
- Ukládá historii změn

### Proces 4: Ukončení zakázky a fakturace

**Schválení ukončení**:
- Majitel označí zakázku jako dokončenou
- Systém zazamkne další evidence
- Spustí se proces generování faktury

**Generování faktury pro zákazníka**:
- Automaticky vytvoří fakturu s všemi položkami
- Použije prodejní ceny z posledního výpočtu
- Aplikuje platební podmínky zákazníka
- Vyexportuje do PDF nebo účetního systému

**Vyúčtování pro OSVČ**:
- Systém spočítá celkovou částku pro každého OSVČ
- Vygeneruje podklady pro fakturu od OSVČ
- Pošle notifikaci s informacemi pro fakturaci

---

## Datové toky a závislosti

### Tok dat při evidenci práce:
1. **Pracovník** → Evidence úkonu → **DB Zakázky**
2. **DB Zakázky** → Propojení s **DB Ceny úkonů** → Výpočet nákladů
3. **Výpočet** → Aktualizace **DB Výdělky pracovníka**
4. **Automatický proces** → Agregace všech dat → **Report nákladů**

### Tok dat při evidenci materiálu:
1. **Majitel** → Evidence materiálu → **DB Zakázky**
2. **DB Zakázky** → Odpočet ze **DB Materiál**
3. **DB Materiál** → Kontrola minimálních zásob → **Upozornění**
4. **Automatický proces** → Výpočet nákladů → **Report ziskovosti**

### Tok dat při fakturaci:
1. **Ukončení zakázky** → Trigger → **Proces fakturace**
2. **DB Zakázky** → Agregace všech nákladů → **Podklady faktury**
3. **DB Zákazníci** → Fakturační údaje → **Generování PDF**
4. **DB OSVČ** → Výpočet odměn → **Podklady pro jejich faktury**

---

## Konkrétní příklady workflow

### Příklad 1: Grafická firma - Banner na budovu

**Zakázka**: Výroba a instalace banneru 20m² pro firmu ABC

**Krok 1**: Majitel vytvoří zakázku
- Zákazník: Firma ABC s.r.o.
- Rozpočet: 15,000 Kč
- Termín: 7 dní
- Přiřazení: Grafik Novák, Instalatér Svoboda

**Krok 2**: Evidence práce
- Grafik Novák: "Návrh grafiky" - 4 hodiny × 300 Kč = 1,200 Kč
- Grafik Novák: "Tisk banneru" - 20 m² × 150 Kč = 3,000 Kč
- Instalatér Svoboda: "Instalace typ A" - 20 m² × 200 Kč = 4,000 Kč

**Krok 3**: Evidence materiálu
- Banner materiál: 22 m² × 80 Kč = 1,760 Kč (nákupní cena)
- Montážní materiál: 500 Kč

**Krok 4**: Automatický výpočet (po 24h)
- Náklady celkem: 1,200 + 3,000 + 4,000 + 1,760 + 500 = 10,460 Kč
- Prodejní cena: 1,500 + 3,750 + 5,000 + 2,200 + 625 = 13,075 Kč
- Zisk: 2,615 Kč (20%)

**Krok 5**: Ukončení a fakturace
- Majitel schválí ukončení
- Automaticky se vygeneruje faktura pro ABC s.r.o. na 13,075 Kč
- OSVČ nedostane žádnou notifikaci (nejsou na projektu)

### Příklad 2: Stavební firma s OSVČ

**Zakázka**: Rekonstrukce koupelny pro paní Novákovou

**Účastníci**:
- Majitel (koordinace)
- Zaměstnanec - instalatér Dvořák
- OSVČ - obkladač Černý

**Evidence práce**:
- Instalatér Dvořák: 3 dny × 8 hodin × 250 Kč = 6,000 Kč
- OSVČ Černý: "Obkládání" 15 m² × 300 Kč = 4,500 Kč

**Evidence materiálu**:
- Obklady: 15 m² × 400 Kč = 6,000 Kč
- Instalatérský materiál: 2,500 Kč

**Automatický výpočet**:
- Total náklady: 19,000 Kč
- Prodejní cena: 28,500 Kč
- Zisk: 9,500 Kč (50%)

**Po ukončení**:
- Faktura pro paní Novákovou: 28,500 Kč
- Notifikace pro OSVČ Černého: "Vystavte fakturu na 4,500 Kč za obkládání"

---

## Automatické procesy a notifikace

### Denní automatické procesy (1x za 24h):
1. **Přepočet nákladů** všech aktivních zakázek
2. **Kontrola rozpočtů** - varování při překročení
3. **Kontrola skladů** - upozornění na nízké zásoby
4. **Aktualizace reportů** ziskovosti a výkonnosti

### Trigger při ukončení zakázky:
1. **Zamknutí evidence** - další změny nejsou možné
2. **Finální výpočet** všech nákladů a prodejních cen
3. **Generování faktury** pro zákazníka
4. **Notifikace OSVČ** s podklady pro jejich faktury
5. **Archivace zakázky** do historie

### Komunikační systém:
- **Interní zprávy** mezi majitelem a pracovníky
- **Automatické notifikace** o změnách v zakázkách
- **Emailové upozornění** na důležité události
- **Dashboard notifikace** pro každou roli

---

## Konfigurace podle typu firmy

### Grafická firma:
- Úkony: Návrh, tisk, instalace, potisk
- Jednotky: m², ks, hodiny
- Materiály: Bannery, barvy, lepidla

### Stavební firma:
- Úkony: Zednictví, instalace, malování, úklid
- Jednotky: m², m³, ks, hodiny
- Materiály: Cement, cihly, trubky, barvy

### IT služby:
- Úkony: Vývoj, testování, deploy, konzultace
- Jednotky: Hodiny, story points, ks
- Materiály: Licence, hardware, hosting

---

## Bezpečnost a GDPR

### Ochrana dat:
- **Šifrování** všech osobních údajů
- **Role-based access** - každý vidí jen svá data
- **Audit log** všech změn
- **Pravidelné zálohy** s šifrováním

### GDPR compliance:
- **Souhlasy** s evidencí v DB zákazníků
- **Právo na zapomenutí** - možnost smazání dat
- **Export dat** na požádání zákazníka
- **Minimalizace dat** - ukládání jen potřebných údajů

---

## Reporty, analýzy a exporty

### Pro majitele:
- **Přehled ziskovosti** podle zakázek
- **Výkonnost pracovníků** (produktivita, kvalita)
- **Analýza zákazníků** (objem, pravidelnost)
- **Skladové reporty** (obrátkovost, náklady)
- **Finanční přehledy** (cash flow, očekávané příjmy)

### Pro pracovníky:
- **Vlastní výdělky** za období
- **Odpracované hodiny** s detaily
- **Hodnocení výkonnosti** od majitele
- **Plánované zakázky** na následující období

### Exporty dat
Systém umožní export klíčových dat pro další zpracování nebo archivaci:
- **Faktury**: Export do PDF.
- **Souhrn zakázky**: Kompletní report zakázky (práce, materiál, náklady, zisk) do PDF.
- **Finanční reporty**: Export přehledů do CSV nebo Excel (XLSX) pro další analýzu.
- **Data pro účetnictví**: Možnost exportu dat v kompatibilním formátu pro běžné účetní systémy.

---

*Tento dokument popisuje kompletní logiku procesů aplikace Firemní-Asistent na základě analýzy původních požadavků. Slouží jako základ pro další diskusi a případné úpravy před zahájením implementace.*
