# Databázové Schéma - Firemní Asistent

Tento dokument definuje strukturu databáze pro aplikaci Firemní Asistent. Používáme PostgreSQL.

**Legenda:**
- `SERIAL PRIMARY KEY`: Unikátní, automaticky se zvyšující číslo (ID).
- `VARCHAR(255)`: Textový řetězec s maximální délkou 255 znaků.
- `TEXT`: Textový řetězec bez omezení délky.
- `DECIMAL(12, 2)`: Desetinné číslo s celkem 12 místy, z toho 2 za desetinnou čárkou (vhodné pro peníze).
- `INTEGER`: Celé číslo.
- `BOOLEAN`: Hodnota Pravda/Nepravda (true/false).
- `TIMESTAMP WITH TIME ZONE`: Časové razítko včetně časové zóny.
- `NOT NULL`: Pole musí být vždy vyplněno.
- `REFERENCES nazev_tabulky(id)`: Cizí klíč, který se odkazuje na primární klíč v jiné tabulce.

---

## Tabulka: `zakaznici`

Uchovává informace o všech klientech (firmy i jednotlivci).

| Název sloupce | Datový typ | Omezení | Popis |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unikátní ID zákazníka |
| `nazev_firmy` | `VARCHAR(255)` | `NOT NULL` | Oficiální název firmy nebo jméno a příjmení |
| `ico` | `VARCHAR(20)` | | IČO |
| `dic` | `VARCHAR(20)` | | DIČ |
| `fakturacni_adresa`| `TEXT` | `NOT NULL` | Kompletní adresa pro fakturaci |
| `kontaktni_osoba` | `VARCHAR(255)` | | Jméno hlavní kontaktní osoby |
| `email` | `VARCHAR(255)` | `NOT NULL` | Kontaktní email |
| `telefon` | `VARCHAR(50)` | | Kontaktní telefon |
| `platebni_podminky`| `INTEGER` | `DEFAULT 14` | Splatnost faktur ve dnech |
| `poznamka` | `TEXT` | | Interní poznámky k zákazníkovi |
| `vytvoren_v` | `TIMESTAMP` | `DEFAULT now()` | Čas vytvoření záznamu |

---

## Tabulka: `zamestnanci`

Evidence všech pracovníků, ať už interních zaměstnanců nebo externích OSVČ.

| Název sloupce | Datový typ | Omezení | Popis |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unikátní ID zaměstnance |
| `jmeno` | `VARCHAR(255)` | `NOT NULL` | Celé jméno pracovníka |
| `email` | `VARCHAR(255)` | `NOT NULL, UNIQUE`| Přihlašovací email |
| `heslo_hash` | `VARCHAR(255)` | `NOT NULL` | Bezpečně uložené heslo (hash) |
| `role` | `VARCHAR(50)` | `NOT NULL` | Role v systému ('majitel', 'zamestnanec', 'osvc') |
| `hodinova_sazba` | `DECIMAL(12, 2)`| `NOT NULL` | Výchozí hodinová sazba |
| `aktivni` | `BOOLEAN` | `DEFAULT true` | Zda je účet aktivní |
| `vytvoren_v` | `TIMESTAMP` | `DEFAULT now()` | Čas vytvoření záznamu |

---

## Tabulka: `dodavatele`

Informace o dodavatelích materiálu.

| Název sloupce | Datový typ | Omezení | Popis |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unikátní ID dodavatele |
| `nazev_firmy` | `VARCHAR(255)` | `NOT NULL` | Oficiální název firmy |
| `ico` | `VARCHAR(20)` | | IČO |
| `kontaktni_osoba` | `VARCHAR(255)` | | |
| `email` | `VARCHAR(255)` | | |
| `telefon` | `VARCHAR(50)` | | |
| `poznamka` | `TEXT` | | |

---

## Tabulka: `material`

Skladová evidence veškerého materiálu.

| Název sloupce | Datový typ | Omezení | Popis |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unikátní ID materiálu |
| `kod_materialu` | `VARCHAR(100)` | `UNIQUE` | Interní kód (SKU) |
| `nazev` | `VARCHAR(255)` | `NOT NULL` | Název materiálu |
| `popis` | `TEXT` | | Detailnější popis |
| `merna_jednotka` | `VARCHAR(20)` | `NOT NULL` | např. 'ks', 'm', 'm2', 'kg' |
| `mnozstvi_skladem`| `DECIMAL(12, 2)`| `DEFAULT 0` | Aktuální množství na skladě |
| `minimalni_zasoba`| `DECIMAL(12, 2)`| `DEFAULT 0` | Hranice pro upozornění na nízký stav |
| `nakupni_cena` | `DECIMAL(12, 2)`| `NOT NULL` | Nákupní cena za měrnou jednotku (bez DPH) |
| `prodejni_cena` | `DECIMAL(12, 2)`| `NOT NULL` | Prodejní cena za měrnou jednotku (bez DPH) |
| `dodavatel_id` | `INTEGER` | `REFERENCES dodavatele(id)` | Odkaz na preferovaného dodavatele |

---

## Tabulka: `cenik_prace`

Ceník standardizovaných pracovních úkonů.

| Název sloupce | Datový typ | Omezení | Popis |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unikátní ID úkonu |
| `nazev_ukonu` | `VARCHAR(255)` | `NOT NULL` | Např. "Lepení grafiky", "Instalace baneru" |
| `merna_jednotka` | `VARCHAR(20)` | `NOT NULL` | např. 'hod', 'm2', 'ks' |
| `prodejni_cena` | `DECIMAL(12, 2)`| `NOT NULL` | Prodejní cena za měrnou jednotku |

---

## Tabulka: `zakazky`

Hlavní tabulka pro správu všech zakázek.

| Název sloupce | Datový typ | Omezení | Popis |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | Unikátní ID zakázky |
| `nazev_zakazky` | `VARCHAR(255)` | `NOT NULL` | |
| `zakaznik_id` | `INTEGER` | `NOT NULL, REFERENCES zakaznici(id)` | Odkaz na zákazníka |
| `stav` | `VARCHAR(50)` | `DEFAULT 'aktivni'` | 'aktivni', 'dokoncena', 'fakturovana', 'zrusena' |
| `rozpocet` | `DECIMAL(12, 2)`| | Plánovaný rozpočet (volitelné) |
| `vytvorena_v` | `TIMESTAMP` | `DEFAULT now()` | |
| `dokoncena_v` | `TIMESTAMP` | | |

---

## Spojovací Tabulky (Vztahy)

Tyto tabulky propojují ostatní tabulky a definují vztahy "mnoho k mnoha".

### `zakazka_material` (Spotřebovaný materiál na zakázce)

| Název sloupce | Datový typ | Omezení | Popis |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | |
| `zakazka_id` | `INTEGER` | `NOT NULL, REFERENCES zakazky(id)` | |
| `material_id` | `INTEGER` | `NOT NULL, REFERENCES material(id)` | |
| `mnozstvi` | `DECIMAL(12, 2)`| `NOT NULL` | Spotřebované množství |
| `nakupni_cena_v_case`| `DECIMAL(12, 2)`| `NOT NULL` | Nákupní cena v momentě přidání |
| `prodejni_cena_v_case`|`DECIMAL(12, 2)`| `NOT NULL` | Prodejní cena v momentě přidání |
| `pridal_zamestnanec_id`| `INTEGER` | `NOT NULL, REFERENCES zamestnanci(id)` | |
| `pridano_v` | `TIMESTAMP` | `DEFAULT now()` | |

### `zakazka_prace` (Odvedená práce na zakázce)

| Název sloupce | Datový typ | Omezení | Popis |
|---|---|---|---|
| `id` | `SERIAL` | `PRIMARY KEY` | |
| `zakazka_id` | `INTEGER` | `NOT NULL, REFERENCES zakazky(id)` | |
| `zamestnanec_id` | `INTEGER` | `NOT NULL, REFERENCES zamestnanci(id)` | Kdo práci vykonal |
| `cenik_prace_id` | `INTEGER` | `REFERENCES cenik_prace(id)` | Odkaz na standardní úkon (pokud existuje) |
| `popis_prace` | `TEXT` | | Ruční popis, pokud nejde o standardní úkon |
| `mnozstvi` | `DECIMAL(12, 2)`| `NOT NULL` | Počet hodin, m2, ks... |
| `nakladova_sazba_v_case`| `DECIMAL(12, 2)`| `NOT NULL` | Nákladová sazba pracovníka |
| `prodejni_sazba_v_case`| `DECIMAL(12, 2)`| `NOT NULL` | Prodejní cena úkonu |
| `pridano_v` | `TIMESTAMP` | `DEFAULT now()` | |

### `zakazka_zamestnanci` (Přiřazení pracovníci k zak��zce)

| Název sloupce | Datový typ | Omezení | Popis |
|---|---|---|---|
| `zakazka_id` | `INTEGER` | `NOT NULL, REFERENCES zakazky(id)` | |
| `zamestnanec_id` | `INTEGER` | `NOT NULL, REFERENCES zamestnanci(id)` | |
| | | `PRIMARY KEY (zakazka_id, zamestnanec_id)` | Zajišťuje, že každý je přiřazen jen jednou |
