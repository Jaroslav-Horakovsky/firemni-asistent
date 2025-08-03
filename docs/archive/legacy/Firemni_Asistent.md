# Firemní asistent

## Technologický směr a vize

Pro zajištění maximální flexibility, rychlosti a budoucí rozšiřitelnosti bylo na začátku projektu učiněno klíčové strategické rozhodnutí:

**Veškerá komunikace mezi frontendovými aplikacemi (desktop, mobil) a backendem bude probíhat přes GraphQL API.**

Tento přístup nám umožní efektivně vyvíjet rychlé a moderní klienty a zároveň staví pevné základy pro budoucí implementaci **inteligentního AI asistenta**, který bude schopen odpovídat na komplexní dotazy v reálném čase.

Detailní popis této dlouhodobé vize je popsán v dokumentu: `Vize_AI_Asistent.md`.

---

K čemu bude sloužit:



- Evidence práce

- Evidence spotřebovaného materiálu na konkrétní zakázce

- Evidence pracovních hodin strávených na konkrétní zakázce

- Souhrny konkrétních zakázek

- Průběžné počítání nákladů na zakázku (1x za 24h)

- Po potvrzení ukončení zakázky se automaticky vygeneruje Faktura pro konkrétního zákazníka

- Pro Majitele

- Pro zaměstnance

- Pro OSVČ najatých na práci





Potřebné Databaze:

- DB zákazníci/klienti (jak jednotlivci, tak i celé firmy)

- DB zaměstnanci

- DB materiál

- DB cena pracovních úkonů (předpřipravená databáze do které si každý v aplikaci doplní vše potřebné podle zaměření firmy)

- Dodavatelé





| DB Zákazníci – Jak jednotlivci, tak i firmy


🔹 Údaje o firmě (právnické osobě)


🔹 Kontaktní osoby | Interní poznámky (např. reference, historie spolupráce) |
| --- | --- |





🔹 Obchodní a smluvní informace

| Pole | Popis |
| --- | --- |
| Typ zákazníka | Nový / aktivní / VIP / bývalý |
| Datum první spolupráce | Historie vztahu |
| Smlouva / rámcová dohoda | Odkaz na uložený dokument nebo č. smlouvy |
| Obchodník | Kdo má klienta na starosti |
| Platební podmínky | Např. 14 dní, 30 dní, zálohy |
| Poznámky k fakturaci | Speciální požadavky (např. fakturovat centrále) |





🔹 GDPR a souhlasy

| Pole | Popis |
| --- | --- |
| Souhlas se zpracováním údajů | Ano / Ne (např. newsletter) |
| Datum udělení souhlasu | Povinné dle GDPR |
| Způsob sběru | Online formulář / papír / e-mail |





🔹 Interní informace (volitelné, ale užitečné)

| Pole | Popis |
| --- | --- |
| CRM ID | Pokud používáš CRM systém |
| Kategorie | Např. velký odběratel, reseller, partner |
| Zdroje leadu | Např. konference, doporučení, online formulář |
| Historie objednávek | Propojení s fakturačním systémem |





✳ Doporučení:

Používej jednoznačný primární klíč (např. ID zákazníka)

Normalizuj data (odděleně tabulka zákazníků, kontaktů, faktur)

Pravidelně aktualizuj – kontakty se mění!





# DB – Zaměstnanci

Jméno

Příjmení

Adresa

IČO

DIČ

Smlouva (zaměstnanec, nebo živnostník-dohoda o provedení práce)

Právní forma (zaměstnanec, živnostník)

Telefon

Email

Další kontakt

Web

Poznámka

Ohodnocení pracovních úkonů

Ohodnocení hodinove mzdy







# DB – Materiál



🔹 Základní identifikační údaje

| Sloupec | Popis |
| --- | --- |
| ID | Jedinečný identifikátor (např. automatické číslo) |
| Kód materiálu | Interní kód nebo SKU (např. "MAT-00123") |
| Název materiálu | Např. "Hliníkový profil 2m" |
| Popis | Detailní popis materiálu (např. rozměry, použití) |
| Kategorie | Typ (např. kov, elektro, plast, spojovací materiál) |





🔹 Skladové a logistické údaje

| Sloupec | Popis |
| --- | --- |
| Skladová jednotka | Měrná jednotka (např. ks, m, kg, l) |
| Množství na skladě | Aktuální počet kusů/množství |
| Minimální zásoba | Hodnota, kdy se má spustit objednávka |
| Umístění ve skladu | Regál / řada / pozice |
| Datum posledního pohybu | Poslední příjem/výdej |





🔹 Cenové údaje

| Sloupec | Popis |
| --- | --- |
| Nákupní cena | Cena za jednotku bez DPH |
| Prodejní cena | Pokud prodáváš, uváděj s/bez DPH |
| Dodavatel | Název nebo ID firmy |
| Číslo objednávky | Interní referenční číslo (např. z nákupu) |
| Datum pořízení | Kdy byl materiál nakoupen/dodán |





🔹 Technické nebo výrobní údaje (pokud je to relevantní)

| Sloupec | Popis |
| --- | --- |
| Specifikace | Např. norma DIN, EN, velikost, pevnost |
| Výrobce | Značka nebo firma |
| Šarže / LOT | Pokud sleduješ výrobní dávky |
| Expirace | U chemie nebo citlivého materiálu |





🔹 Interní a volitelné sloupce

| Sloupec | Popis |
| --- | --- |
| Poznámka | Např. stav, poznámky ke kvalitě |
| Příloha / dokumentace | Odkaz na PDF, technický list apod. |
| Aktivní | TRUE/FALSE (zda je materiál stále aktivní) |















# DB cena pracovních úkonů

předpřipravená databáze do které si každý v aplikaci doplní vše potřebné podle zaměření firmy

Příklad: Když aplikaci bude používat živnostník co vyrábí grafiku (celoplošný tisk, bannery, 3D loga, výrobky s 3D tisku, potisk oděvu ..)

Pracovní úkony:

- Lepení grafiky – cena za m2

- Cena pracovní hodiny při Pracovních úkonech

- Instalace baneru  - 3 typy instalace – cena za m2

- 3D loga – individuální nacenění

- Potisk oděvu – cena podle velikosti potisku

- Atd



# DB Dodavatelé

1 Základní identifikační údaje

| Sloupec | Popis / proč je důležitý |
| --- | --- |
| ID dodavatele | Primární klíč (interní číslo) |
| Název firmy | Obchodní jméno |
| IČO / DIČ | Povinné pro fakturaci a ověření v rejstřících |
| Právní forma | s.r.o., a.s., OSVČ … (pomáhá při hodnocení rizik) |
| Sídlo | Ulice, město, PSČ, stát |
| Fakturační adresa | Pokud se liší od sídla |



2 Kontaktní informace

| Sloupec | Popis |
| --- | --- |
| Hlavní kontakt – jméno | Obvykle obchodní zástupce |
| Pozice / role | Např. Sales Manager, Account Exec |
| Email | Primární komunikační kanál |
| Telefon | Mobil / pevná linka |
| Web / LinkedIn | Rychlé ověření informací |



TIP: SAP doporučuje evidovat více kontaktů a třídit je podle role (objednávky, kvalita, finance) .

3 Bankovní a platební údaje

| Sloupec | Popis |
| --- | --- |
| Banka | Název banky |
| IBAN / SWIFT | Pro zahraniční platby |
| Měna nákupu | CZK, EUR … (vendorspecific currency) |
| Platební podmínky | 14 dní / 30 dní … |
|  |  |







# Role

- Admin
- Majitel firmy (Desktop + Mobil)
- Zaměstnanec (Mobil)
- OSVČ najatý na práci (Mobil)

Majitel
- Aplikace by mu měla sloužit tak že bude mít formulář pomocí kterého vytvoří zakázku
- Bude moct přiřazovat Zaměstnance nebo OSVČ najeté na práci k jednotlivým zakázkám ¨
- Bude mít Pole, do kterého bude moct průběžně zadávat použitý materiál na zakázce.
- Bude mít pole kde bude moct průběžně zadávat pracovní úkony
- Aplikace mu bude dělat přehled kolik jsou náklady na konkrétní zakázce (cena pro něj, a cena pro koncového zákazníka, náklad na zaměstnance nebo živnostníka
- Reporty a souhrny o zákaznících, klientech, zaměstnancích, OSVČ, dodavatelích s možností exportu do PDF a CSV.
- Pomocí aplikace bude moct majitel komunikovat se zaměstnanci a OSVČ najatých na práci

Zaměstnanec

- Může v zakázce, ke které je přiřazen Majitelem průběžně přidávat Pracovní Úkony které během plnění zakázky vykonává, nebo si zapsat kolik hodin na zakázce pracoval

- Uvidí svůj souhrn a přehled kolik odpracoval hodin a jaké pracovní úkony provedl a kolik mu je za to vyměřen plat





OSVČ najatý na práci

- Může v zakázce, ke které je přiřazen Majitelem průběžně přidávat Pracovní Úkony které během plnění zakázky vykonává, nebo si zapsat kolik hodin na zakázce pracoval

- Uvidí svůj souhrn a přehled kolik odpracoval hodin a jaké pracovní úkony provedl a kolik mu je za to vyměřen plat

- Po ukončení zakázky Majitelem mu přijde do aplikace částka a info do faktury kterou si může vystavit a poslat k proplacení



