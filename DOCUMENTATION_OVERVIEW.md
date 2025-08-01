# PŘEHLED DOKUMENTAČNÍCH SOUBORŮ - PROJEKT FIREMNÍ ASISTENT

**Datum vytvoření:** 2025-08-01  
**Poslední aktualizace:** 2025-08-01 17:50 (po dokončení RELACE 17 Phase 3)
**Účel:** Přehled všech .md souborů, jejich stav a doporučené akce pro pořádek

---

## 📁 AKTUÁLNÍ DOKUMENTACE (POUŽÍVÁ SE)

### Hlavní projektová dokumentace:
- **`README.md`** ✅ AKTUÁLNÍ - Základní info o projektu
- **`ARCHITECTURE.md`** ✅ AKTUÁLNÍ - Architektonický přehled
- **`SCHEMA.md`** ✅ AKTUÁLNÍ - Database schéma
- **`SECURITY.md`** ✅ AKTUÁLNÍ - Bezpečnostní konfigurace
- **`DEVOPS.md`** ✅ AKTUÁLNÍ - DevOps procesy

### Relace 17 kontext (uložen v ~/.claude):
- **`~/.claude/RELACE17_PROGRESS.md`** ✅ AKTUÁLNÍ - Progress tracker (95% complete)
- **`~/.claude/RELACE17_CURRENT_STATE.md`** ✅ AKTUÁLNÍ - Snapshot stavu (Phase 3 COMPLETE)
- **`~/.claude/RELACE17_PHASE4_PLAN.md`** ✅ AKTUÁLNÍ - Plán Phase 4 (Email Notifications)
- **`~/.claude/RELACE17_DEBUGGING_CONTEXT.md`** ⚠️ ZASTARALÉ - Debug info z dřívějších phases

---

## ⚠️ DOKUMENTACE K AKTUALIZACI

### Zastaralá - potřebuje refresh:
- **`CURRENT_PROJECT_STATUS.md`** 🔄 ZASTARALÉ - Status z dřívějších relací
- **`SERVER_STARTUP_GUIDE.md`** 🔄 MOŽNÁ ZASTARALÉ - Check startup procedury
- **`TODO.md`** 🔄 ZASTARALÉ - Obecné todo položky
- **`TODO_NEXT_SESSIONS.md`** 🔄 ZASTARALÉ - Session plány

### Aktuální relace kontext v projektu:
- **`RELACE17_CONTEXT.md`** 📦 ARCHIVOVAT - Nahrazeno soubory v ~/.claude
- **`RELACE17_QUICK_SETUP.md`** 📦 ARCHIVOVAT - Nahrazeno detailnějšími soubory

---

## 📦 DOKUMENTACE K ARCHIVACI

### Hotové relace (přesunout do docs/archive/):
- **`RELACE15_FINAL_SUCCESS.md`** 📦 ARCHIVOVAT - Dokončená relace
- **`RELACE16_COMPLETE_SUCCESS.md`** 📦 ARCHIVOVAT - Dokončená relace  
- **`RELACE16_CONTEXT.md`** 📦 ARCHIVOVAT - Starý kontext
- **`RELACE16_CONTINUATION_PROMPT.md`** 📦 ARCHIVOVAT - Starý prompt
- **`RELACE16_QUICK_SETUP.md`** 📦 ARCHIVOVAT - Starý setup

### Staré dokumenty - potenciálně zastaralé:
- **`BUSINESS_REQUIREMENTS_SESSION.md`** 📦 MOŽNÁ ARCHIVOVAT - Check obsah
- **`DATABASE_DESIGN_FINALIZATION.md`** 📦 MOŽNÁ ARCHIVOVAT - DB design dokončen
- **`DATABASE_MIGRATION_PLAN.md`** 📦 MOŽNÁ ARCHIVOVAT - Migrace hotová
- **`GRAPHQL_API.md`** 📦 MOŽNÁ ARCHIVOVAT - GraphQL není používáno
- **`LOGGING.md`** 📦 MOŽNÁ ARCHIVOVAT - Check aktuálnost
- **`MULTI_ENVIRONMENT_STRATEGY.md`** 📦 MOŽNÁ ARCHIVOVAT - Check relevance
- **`NPM_NODE_ISSUES_ANALYSIS.md`** 📦 ARCHIVOVAT - Vyřešené problémy

### Originální dokumenty:
- **`Firemni_Asistent.md`** 📦 ARCHIVOVAT - Původní koncept
- **`Logika_Procesu_Firemni_Asistent.md`** 📦 ARCHIVOVAT - Původní logika
- **`Ukoly_pro_Jaru.md`** 📦 ARCHIVOVAT - Historické úkoly
- **`Vize_AI_Asistent.md`** 📦 ARCHIVOVAT - Původní vize

### Pomocné soubory:
- **`NEXT_SESSION_SUMMARY.md`** 📦 ARCHIVOVAT - Starý summary
- **`CREDENTIALS_LOCAL.md`** ❓ CHECK - Možná aktuální credentials

---

## 🏗️ DOKUMENTACE V docs/ SLOŽCE

### Aktuální struktura docs/:
```
docs/
├── RELACE4_IMPLEMENTATION_SUMMARY.md ✅ ARCHIVOVÁNO
├── archive/
│   ├── README.md ✅ ARCHIVNÍ INDEX
│   ├── relace-history/ ✅ HISTORICKÉ RELACE (9-14)
│   └── troubleshooting/ ✅ ARCHIVNÍ TROUBLESHOOTING
└── [další archivy]
```

---

## 📋 DOPORUČENÉ AKCE PRO DALŠÍ RELACI

### 1. PŘESUNOUT DO docs/archive/:
```bash
# Hotové relace
mv RELACE15_FINAL_SUCCESS.md docs/archive/relace-history/
mv RELACE16_*.md docs/archive/relace-history/

# Staré dokumenty
mv Firemni_Asistent.md docs/archive/
mv Logika_Procesu_Firemni_Asistent.md docs/archive/
mv Ukoly_pro_Jaru.md docs/archive/
mv Vize_AI_Asistent.md docs/archive/
mv NEXT_SESSION_SUMMARY.md docs/archive/
mv NPM_NODE_ISSUES_ANALYSIS.md docs/archive/troubleshooting/
```

### 2. PŘESUNOUT RELACE17 KONTEXT:
```bash
# Z ~/.claude do projektu (po dokončení RELACE 17 na 100%)
mkdir -p docs/relace17/
mv ~/.claude/RELACE17_*.md docs/relace17/

# Také přesunout project-level RELACE17 soubory
mv RELACE17_CONTEXT.md docs/relace17/
mv RELACE17_QUICK_SETUP.md docs/relace17/
```

### 3. AKTUALIZOVAT:
- `CURRENT_PROJECT_STATUS.md` - Nový status po RELACE 17
- `TODO.md` - Aktuální priority
- `SERVER_STARTUP_GUIDE.md` - Verify startup procedures

### 4. ZKONTROLOVAT A ROZHODNOUT:
- `BUSINESS_REQUIREMENTS_SESSION.md` - Je relevantní?
- `DATABASE_DESIGN_FINALIZATION.md` - Je aktuální?
- `CREDENTIALS_LOCAL.md` - Obsahuje aktuální údaje?
- `LOGGING.md` - Je logging dokumentace aktuální?

---

## 🎯 IDEÁLNÍ STAV PO REORGANIZACI

### Root level (jen aktivní):
- README.md
- ARCHITECTURE.md  
- SCHEMA.md
- SECURITY.md
- DEVOPS.md
- CURRENT_PROJECT_STATUS.md (aktualizovaný)
- TODO.md (aktualizovaný)
- SERVER_STARTUP_GUIDE.md (zkontrolovaný)

### docs/ structure:
```
docs/
├── relace17/ (nová složka po dokončení)
├── archive/
│   ├── relace-history/ 
│   ├── troubleshooting/
│   └── original-concepts/
└── active/ (případně pro aktivní dokumenty)
```

### ~/.claude (jen global config):
- CLAUDE.md (global MCP config)

---

## ✅ AKCE PRO PŘÍŠTÍ RELACI

1. **Dokončit RELACE 17** (Phase 4 - Email Notifications) ← ZBÝVÁ 5%
2. **Přesunout RELACE17 soubory** z ~/.claude do docs/relace17/ (po dokončení)
3. **Archivovat staré soubory** podle seznamu výše
4. **Aktualizovat core dokumentaci** (CURRENT_PROJECT_STATUS.md, TODO.md)
5. **Vyčistit root directory** od zastaralých souborů

**Aktuální stav:** RELACE 17 na 95% - Phase 3 (Stripe Webhooks) dokončeno ✅
**Cíl:** Dokončit na 100% a pak reorganizovat dokumentaci ✅