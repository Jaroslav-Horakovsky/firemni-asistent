# Vize: Inteligentní Firemní Asistent (Hlasové Ovládání)

Tento dokument popisuje dlouhodobou vizi aplikace **Firemní Asistent**, která přesahuje běžnou správu zakázek a směřuje k vytvoření proaktivního, inteligentního partnera pro řízení firmy.

## 1. Koncept: Dialog s Vaší Firmou

Cílem je umožnit majiteli vést s aplikací přirozený dialog v reálném čase, a to i pomocí hlasu (VoiceMode). Místo proklikávání reportů a hledání v tabulkách se majitel bude moci jednoduše zeptat na komplexní otázky, například:

*   *"Jaká je aktuální ziskovost na zakázce pro Kováře a kolik nás stál materiál oproti plánu?"*
*   *"Který z mých zaměstnanců byl minulý měsíc nejproduktivnější a na jakých typech úkonů?"*
*   *"Máme dostatek hliníkových profilů na skladě pro novou poptávku od firmy ABC, a pokud ne, od kterého dodavatele je nejlepší je objednat?"*
*   *"Ukaž mi všechny zakázky, kde marže klesla pod 20 %."*

AI asistent musí takový dotaz pochopit, okamžitě si vyžádat správná data ze systému a srozumitelně odpovědět.

## 2. Technologický Klíč: Proč GraphQL?

Pro realizaci této vize je volba technologie pro API (aplikační rozhraní) naprosto zásadní. Z tohoto důvodu bylo strategicky rozhodnuto použít **GraphQL** namísto tradičního REST API.

### Problémy s REST API pro AI:
- **Mnoho požadavků (High Latency):** Pro zodpovězení komplexního dotazu by AI musela poslat na server mnoho samostatných požadavků (jeden na zakázky, další na materiál, další na pracovníky atd.). Tato "upovídanost" by vedla k velkému zpoždění, které je pro plynulý hlasový dialog nepřijatelné.
- **Zbytečná data (Over-fetching):** REST API by vracelo celé datové struktury, i když AI potřebuje jen pár konkrétních polí (např. jen cenu a počet kusů, ale ne celý popis materiálu). To zbytečně zatěžuje síť a zpomaluje zpracování.

### Výhody GraphQL pro AI:
1.  **Flexibilita a Efektivita:** GraphQL umožňuje klientovi (v tomto případě AI asistentovi) sestavit **jeden jediný, komplexní dotaz**, ve kterém si přesně specifikuje všechna data, která potřebuje napříč celým systémem. Server odpoví jedním balíkem dat, což dramaticky snižuje latenci.
2.  **Přesnost (No Over-fetching):** GraphQL vrací pouze ta data, která si klient vyžádal. Žádná data navíc. To je klíčové pro rychlost a efektivitu, zejména na mobilních zařízeních.
3.  **Silně typované Schéma:** GraphQL API je postaveno na schématu, které funguje jako **dokonalá mapa datové struktury celé firmy**. AI se může toto schéma "naučit" a přesně tak ví, na co se může ptát a jak má své dotazy formulovat. To extrémně zjednodušuje logiku AI a dělá systém robustnějším.

## 3. Strategický dopad

Volbou GraphQL od samého počátku stavíme aplikaci na základech, které jsou připravené na budoucnost. I když bude AI asistent implementován až v pozdější fázi, každá část systému, kterou vyvineme dnes (desktopová aplikace, mobilní aplikace), bude těžit z rychlosti a flexibility GraphQL a zároveň bude přirozeně kompatibilní s budoucí AI integrací.
