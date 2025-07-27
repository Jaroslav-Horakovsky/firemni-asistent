# Firemní Asistent - TODO

Tento dokument slouží ke sledování hlavních úkolů a fází projektu.

## ✅ INFRASTUKTURA A TERRAFORM - DOKONČENO (2025-07-27)

### Terraform Infrastructure Modules (7/7 hotových):
- [x] **secrets** modul - Secret Manager integration
- [x] **registry** modul - Artifact Registry
- [x] **iam** modul - Service accounts s hybrid pattern
- [x] **storage** modul - GCS buckets s CDN, DLP, lifecycle policies
- [x] **cloud-run** modul - Všech 7 mikroservices s resilience patterns
- [x] **load-balancer** modul - Global HTTPS LB s data-driven approach
- [x] **monitoring** modul - OpenTelemetry, SLO/SLA, business metrics

### Resilience Patterns a Advanced Automation:
- [x] Circuit breaker implementation (ARCHITECTURE.md)
- [x] Health checks (/live, /ready endpoints)
- [x] Business metrics scaling (DEVOPS.md)
- [x] ML-based failure prediction
- [x] Advanced load balancing strategies

---

## 🔄 PŘÍŠTÍ FÁZE: Multi-Environment Strategy (RELACE 2C)

### Připraveno k implementaci:
- [ ] **Multi-Environment Strategy** - Dev/Staging/Production isolation
- [ ] **Automated Performance Testing** - Load testing + performance regression
- [ ] **Chaos Engineering** - Controlled failure injection
- [ ] **Security Scanning Pipeline** - SAST/DAST/dependency scanning

---

## Fáze 1: Jádro systému a Desktop Aplikace pro Majitele

- [ ] **1. Databáze a Prostředí**
    - [x] Vytvořit detailní databázové schéma (`SCHEMA.md`)
    - [x] Terraform Infrastructure pro production deployment
    - [ ] Založit Git repozitář na GitHubu.
    - [ ] Vytvořit základní adresářovou strukturu projektu.
    - [ ] Vytvořit `docker-compose.yml` pro spuštění PostgreSQL databáze.
    - [ ] Spustit databázi a vytvořit tabulky podle `SCHEMA.md`.

- [ ] **2. Backend (GraphQL API)**
    - [ ] Inicializovat Node.js nebo Python projekt.
    - [ ] Implementovat GraphQL server.
    - [ ] Vytvořit GraphQL schéma odpovídající databázi.
    - [ ] Implementovat "resolvery" pro základní operace (vytvořit, číst, upravit, smazat) pro:
        - [ ] Zákazníky
        - [ ] Zaměstnance (včetně registrace a přihlašování přes JWT)
        - [ ] Materiál
        - [ ] Zakázky
    - [ ] Implementovat logiku pro přidávání práce a materiálu k zakázkám.

- [ ] **3. Desktop Aplikace (Electron + React/Vue)**
    - [ ] Inicializovat projekt (např. pomocí Create React App).
    - [ ] Zabalit aplikaci do Electronu.
    - [ ] Implementovat přihlašovací obrazovku.
    - [ ] Vytvořit hlavní Dashboard pro majitele.
    - [ ] Vytvořit UI pro správu (CRUD) pro:
        - [ ] Zákazníky
        - [ ] Zaměstnance
        - [ ] Materiál
        - [ ] Ceník práce
    - [ ] Vytvořit UI pro správu zakázek (vytvoření, detail zakázky).
    - [ ] Implementovat funkci pro rychlé přidání práce/materiálu k zakázce.
    - [ ] Vytvořit UI pro generování reportů a faktur.

- [ ] **4. Testování (Základ)**
    - [ ] Probrat a dohodnout se na strategii testování.
    - [ ] Napsat základní integrační testy pro klíčové GraphQL operace.

## Fáze 2: Mobilní Aplikace (React Native / Flutter)

- [ ] Návrh UI/UX pro mobilní zařízení (Wireframes).
- [ ] Vývoj mobilní aplikace pro role Zaměstnanec a OSVČ.
- [ ] Vývoj mobilní verze pro Majitele.
- [ ] Testování na reálných zařízeních (Android, iOS).

## Fáze 3: Vize - Inteligentní Asistent

- [ ] Analýza a výběr vhodného AI/LLM modelu.
- [ ] Návrh a implementace VoiceMode rozhraní.
- [ ] Propojení AI s GraphQL API pro pokládání komplexních dotazů.
- [ ] Trénink a ladění modelu na datech firmy.
