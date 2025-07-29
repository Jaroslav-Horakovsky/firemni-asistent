# ÚKOLY PRO JARU - RELACE 6 SETUP

## 📋 CO MUSÍŠ UDĚLAT - KOMPLETNÍ CHECKLIST

### 🔑 1. API KLÍČE A CREDENTIALY

**Google Cloud Platform:**
- ✅ **GCP Project** - HOTOVO ✅ (Project ID: firemni-asistent, Number: 823474921691)
- ✅ **Service Account** pro GitHub Actions - vytvoř SA s oprávněními:
  - `roles/artifactregistry.writer` (push Docker images)
  - `roles/run.admin` (deploy na Cloud Run)  
  - `roles/secretmanager.secretAccessor` (přístup k tajemstvím)
- ✅ **GitHub Secrets** - vlož klíče do GitHub repository secrets:
  - `GCP_WORKLOAD_IDENTITY_PROVIDER`
  - `GCP_SERVICE_ACCOUNT`
  - `GCP_PROJECT_ID_DEV`
  - `GCP_PROJECT_ID_STAGING` 
  - `GCP_PROJECT_ID_PROD`

**Externí služby (pro microservices):**
- ✅ **SendGrid API Key** (pro notification-service)
- ✅ **Stripe API Keys** (pro billing-service)  
- ✅ **JWT Secret** (pro authentication mezi službami)

### 💻 2. SOFTWARE K INSTALACI NA PC

**Povinné:**
```bash
# Node.js management
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Docker Desktop
# HOTOVO ✅ - Docker Desktop 4.43.2 nainstalován s WSL2 integration

# Google Cloud SDK
curl https://sdk.cloud.google.com | bash
gcloud init
gcloud auth application-default login

# Terraform
# Stáhni z https://www.terraform.io/downloads
```

**Doporučené (pro Ubuntu v WSL):**
```bash
# PostgreSQL client - pro práci s databázemi
sudo apt install postgresql-client

# Google Cloud SDK - nainstalovat v Ubuntu (WSL)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL  # Restart shell
gcloud init
gcloud auth application-default login

# Node.js management v Ubuntu (WSL)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# kubectl (pouze pokud budeš používat GKE místo Cloud Run)
gcloud components install kubectl
```

### 🔧 3. VSCODE ROZŠÍŘENÍ

**Kritické pro projekt:**
- ✅ **Docker** - pro práci s Dockerfile a docker-compose
- ✅ **HashiCorp Terraform** - syntax highlighting pro .tf soubory
- ✅ **GraphQL: Language Feature Support** - pro GraphQL schema  
- ✅ **Remote - Containers** - development v Docker kontejnerech
- ✅ **ESLint** a **Prettier** - code formatting

**Již máš nainstalováno (podle CLAUDE.md):**
- ✅ Auto Rename Tag, Live Server, npm Intellisense, GitLens

### 🌐 4. MCP SERVERY - VYUŽITÍ EXISTUJÍCÍCH

**Budeme potřebovat (už máš funkční):**
- ✅ **GitHub MCP** - pro správu repository, issues, PRs
- ✅ **Browser-tools MCP** - pro testování API endpoints
- ✅ **Filesystem MCP** - pro práci se soubory
- ✅ **PostgreSQL MCP** - pro databázové operace
- ✅ **Zen MCP** - pro complex analysis a debugging

**NEPOTŘEBUJEŠ žadné nové MCP servery** - máš vše potřebné!

### ☁️ 5. GCP SETUP POŽADAVKY

**Musíš aktivovat tyto GCP API:**
```bash
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com  
gcloud services enable secretmanager.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

**Vytvořit:**
- ✅ **Artifact Registry** repository pro Docker images
- ✅ **Cloud SQL** PostgreSQL instance
- ✅ **Secret Manager** secrets pro API klíče

### 🐳 6. DOCKER SETUP - WINDOWS 11 + WSL2 + UBUNTU

**TVŮJ SETUP:**
- Windows 11 (host OS)
- WSL2 + Ubuntu (development environment)
- VSCode s WSL extension
- Claude CLI běží v Ubuntu (WSL)

**DOPORUČENÉ ŘEŠENÍ: Docker Desktop (Windows) + WSL2 Integration**

**Proč toto řešení:**
- ✅ Nejjednodušší setup a maintenance
- ✅ GUI pro správu kontejnerů na Windows
- ✅ Automatická integrace s WSL2
- ✅ Lepší performance než Docker jen v WSL
- ✅ Všechny docker příkazy budou fungovat v Ubuntu terminále
- ✅ Claude CLI bude moci ovládat Docker přes Bash tool

**Instalace:**
1. **Stáhnout Docker Desktop pro Windows** z https://www.docker.com/products/docker-desktop
2. **Při instalaci AKTIVOVAT:** "Use WSL 2 instead of Hyper-V"
3. **Po instalaci konfigurovat WSL Integration:**
   - Otevřít Docker Desktop Settings
   - Jít na "Resources" → "WSL Integration"
   - Aktivovat "Enable integration with my default WSL distro"
   - Aktivovat konkrétně "Ubuntu"
   - Kliknout "Apply & Restart"

**Test v tvém Ubuntu prostředí:**
```bash
# VSCode → WSL:Ubuntu → terminál
docker --version
docker-compose --version
docker run hello-world
```

**Výsledek:**
```
# Budeme vytvářet:
# - docker-compose.yml (lokální development)
# - docker-compose.prod.yml (production)
# - Dockerfile pro každou službu
# Vše bude fungovat v Ubuntu terminále, ale Docker daemon běží na Windows
```

### 🗄️ 7. DATABASE SETUP  

**PostgreSQL konfigurace:**
- ✅ **Cloud SQL** instance v GCP
- ✅ **6 databází** - jedna pro každou službu:
  - `user_db`, `customer_db`, `order_db`, `inventory_db`, `billing_db`, `notification_db`
- ✅ **Databázové uživatele** s minimálními oprávněními pro každou službu

### ⚙️ 8. KLÍČOVÁ ROZHODNUTÍ CO MUSÍME UDĚLAT

**Architektura (mé doporučení):**
1. ✅ **Cloud Run** místo GKE (jednodušší start)
2. ✅ **Monorepo** struktura (všechny služby v jednom repo)
3. ✅ **Apollo Federation** pro GraphQL API Gateway

**Struktura projektu:**
```
Firemní_Asistent/
├── services/
│   ├── user-service/
│   ├── customer-service/
│   ├── order-service/
│   ├── inventory-service/
│   ├── billing-service/
│   ├── notification-service/
│   └── gateway/                 # Apollo Federation Gateway
├── docker-compose.yml           # Lokální development
├── docker-compose.prod.yml      # Production
└── terraform/                   # Už existuje
```

---

## 📝 TODO LIST PRO JARU

### 🔥 PRIORITA 1 - MUSÍ BÝT HOTOVO PŘED ZAČÁTKEM RELACE 6

- [x] **Stáhnout a nainstalovat Docker Desktop (Windows) + WSL2 Integration** ✅ HOTOVO
  - [x] Stáhnout Docker Desktop pro Windows z https://www.docker.com/products/docker-desktop ✅
  - [x] Při instalaci AKTIVOVAT: "Use WSL 2 instead of Hyper-V" ✅
  - [ ] Po instalaci otevřít Docker Desktop Settings
  - [ ] Jít na "Resources" → "WSL Integration"
  - [ ] Aktivovat "Enable integration with my default WSL distro"
  - [ ] Aktivovat konkrétně "Ubuntu" (tvoje WSL distro)
  - [ ] Kliknout "Apply & Restart"
  - [ ] Test v Ubuntu (WSL): `docker --version` && `docker-compose --version`
  - [ ] Test kontejneru: `docker run hello-world`

- [ ] **Nainstalovat VSCode rozšíření**
  - [ ] Docker
  - [ ] HashiCorp Terraform  
  - [ ] GraphQL: Language Feature Support
  - [ ] Remote - Containers
  - [ ] ESLint
  - [ ] Prettier - Code formatter

- [ ] **Google Cloud SDK setup (v Ubuntu WSL)**
  - [ ] V Ubuntu terminále spustit: `curl https://sdk.cloud.google.com | bash`
  - [ ] Restart shell: `exec -l $SHELL`
  - [ ] Spustit: `gcloud init`
  - [ ] Spustit: `gcloud auth application-default login`
  - [ ] Ověřit: `gcloud --version`
  
- [ ] **Node.js setup (v Ubuntu WSL)**
  - [ ] Nainstalovat nvm: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash`
  - [ ] Restart shell: `source ~/.bashrc`
  - [ ] Nainstalovat Node.js: `nvm install 20`
  - [ ] Aktivovat: `nvm use 20`
  - [ ] Ověřit: `node --version` && `npm --version`

### 🎯 PRIORITA 2 - GCP KONFIGURACE

**✅ HOTOVO: GCP Project založen (Project ID: firemni-asistent)**

- [x] **Aktivovat GCP APIs** ✅ HOTOVO
  ```bash
  ✅ run.googleapis.com (Cloud Run Admin API)
  ✅ artifactregistry.googleapis.com (Artifact Registry API)
  ✅ secretmanager.googleapis.com (Secret Manager API)
  ✅ sqladmin.googleapis.com (Cloud SQL Admin API)
  ✅ cloudbuild.googleapis.com (Cloud Build API)
  ✅ iam.googleapis.com (IAM API)
  ✅ iamcredentials.googleapis.com (IAM Service Account Credentials API)
  ✅ containerscanning.googleapis.com (Container Scanning API)
  ```

- [x] **Vytvořit Service Account pro GitHub Actions** ✅ HOTOVO
  - [x] Vytvořit SA s názvem: `github-actions-deployer` ✅
  - [x] Přiřadit role: ✅
    - [x] `roles/artifactregistry.writer` ✅
    - [x] `roles/run.admin` ✅
    - [x] `roles/secretmanager.secretAccessor` ✅
  - [x] Nastavit Workload Identity Federation místo JSON klíčů ✅ HOTOVO

- [ ] **Vytvořit GitHub Secrets**
  - [ ] `GCP_WORKLOAD_IDENTITY_PROVIDER`
  - [ ] `GCP_SERVICE_ACCOUNT`
  - [ ] `GCP_PROJECT_ID_DEV`
  - [ ] `GCP_PROJECT_ID_STAGING`
  - [ ] `GCP_PROJECT_ID_PROD`

### 🏗️ PRIORITA 3 - INFRASTRUKTURA

- [x] **Artifact Registry setup** ✅ HOTOVO
  - [x] Vytvořit Docker repository: `firemni-asistent` ✅
  - [x] Nastavit region: `europe-west3` (Frankfurt) ✅
  - [x] Aktivovat Container Scanning API ✅
  - [x] Ověřit push/pull oprávnění ✅

- [ ] **Cloud SQL setup** ⚠️ PLÁNOVÁNO PRO RELACI 7
  - [ ] Vytvořit PostgreSQL instance
  - [ ] Vytvořit 6 databází: `user_db`, `customer_db`, `order_db`, `inventory_db`, `billing_db`, `notification_db`
  - [ ] Vytvořit databázové uživatele pro každou službu
  - [ ] Nastavit síťová oprávnění

- [ ] **Secret Manager setup** ⚠️ PLÁNOVÁNO PRO RELACI 7
  - [ ] Vytvořit secrets pro databázová hesla
  - [ ] Vytvořit secrets pro API klíče (SendGrid, Stripe)
  - [ ] Vytvořit secret pro JWT signing key

### 🔧 PRIORITA 4 - EXTERNÍ SLUŽBY

- [ ] **SendGrid účet a API Key**
  - [ ] Zaregistrovat/získat SendGrid účet
  - [ ] Vytvořit API Key pro notification-service
  - [ ] Uložit do Secret Manager

- [ ] **Stripe účet a API Keys**
  - [ ] Zaregistrovat/získat Stripe účet  
  - [ ] Získat Test API Keys pro billing-service
  - [ ] Uložit do Secret Manager

### 🧪 PRIORITA 5 - OVĚŘENÍ FUNKČNOSTI

- [ ] **Test Docker Desktop + WSL2 Integration**
  - [ ] Ověřit že Docker Desktop běží na Windows
  - [ ] V Ubuntu (WSL) terminále spustit: `docker run hello-world`
  - [ ] Ověřit že kontejner běží a Docker komunikuje přes WSL2
  - [ ] Test docker-compose: `docker-compose --version`

- [ ] **Test GCP přístup**
  - [ ] Spustit: `gcloud projects list`
  - [ ] Ověřit přístup k projektu

- [ ] **Test databáze**
  - [ ] Připojit se k Cloud SQL instanci
  - [ ] Ověřit přístup ke všem databázím

---

## 🚀 PRIORITY SETUP

**✅ KOMPLETNĚ HOTOVO V RELACI 6:**
1. ✅ Docker Desktop WSL2 Integration (Docker 28.3.2 + Compose v2.38.2)
2. ✅ VSCode rozšíření (Docker, Terraform, GraphQL, ESLint, Prettier + bonus)
3. ✅ Google Cloud SDK 532.0.0 (nainstalovaný, PATH fix po restartu)
4. ✅ GCP Projekt: firemni-asistent (ID: 823474921691)
5. ✅ Service Account: github-actions-deployer s oprávněními
6. ✅ Workload Identity Federation: github-actions-pool (OIDC enabled)
7. ✅ Artifact Registry: firemni-asistent v europe-west3
8. ✅ Všechna potřebná GCP APIs aktivována (8 APIs)

**🚀 RELACE 7 - ČÁSTEČNĚ DOKONČENA (29.7.2025):**
- ✅ **System restart** - PATH problémy vyřešeny, vše čisté
- ✅ **Docker Desktop** - běží s WSL2 integration (v28.3.2)  
- ✅ **gcloud authentication** - přihlášen jako horakovsky@apimaster.cz
- ✅ **GCP projekt** - firemni-asistent aktivní a připravený
- ✅ **Cloud SQL PostgreSQL** instance `firemni-asistent-db` RUNNABLE na IP: 34.89.140.144
- ✅ **6 databází vytvořeno:** user_db, customer_db, order_db, inventory_db, billing_db, notification_db
- ✅ **Secret Manager kompletní:** 10 secrets (DB URLs, JWT keys, API placeholders)
- ✅ **Root password nastaven:** secure password vygenerován
- 🚧 **První microservice:** user-service - PŘIPRAVEN K IMPLEMENTACI
- 🚧 **Docker Compose** pro local development - čeká na user-service
- 🚧 **Testing a validace** všech komponent - finální krok

**AKTUÁLNÍ STAV: Database infrastruktura hotová! Příští relace = user-service implementation! 🎯**

---

## ❓ KLÍČOVÁ ROZHODNUTÍ K POTVRZENÍ

**Potvrdíš mi tyto klíčové volby?**
1. **Cloud Run** místo GKE? ✅ / ❌
2. **Monorepo** struktura? ✅ / ❌  
3. **Apollo Federation** pro API Gateway? ✅ / ❌

**Po potvrzení můžeme začít implementací RELACE 6! 🎯**

---

## 📞 KONTAKT

Pokud máš jakékoliv otázky nebo problémy s setup, ozvi se hned!
Lepší je řešit problémy na začátku než v polovině implementace.

**Happy coding! 🚀**