# 💼 BUSINESS REQUIREMENTS SESSION - KRITICKÉ ROZHODNUTÍ

## 🎯 **ÚČEL TOHOTO SEZENÍ**

**PŘED dokončením backendu a přechodem na frontend MUSÍME vyjasnit:**
- Jak PŘESNĚ má aplikace fungovat v produkci
- Jaké business procesy podporovat
- Jaké funkce jsou MUST-HAVE vs NICE-TO-HAVE
- Jak struktura databáze odpovídá reálným potřebám

**PROČ TO DĚLÁME TEĎKA:**
Každá změna po spuštění frontendu = exponenciálně složitější implementace

---

## ❓ **KLÍČOVÉ BUSINESS OTÁZKY**

### **📋 1. ORDERS & PRODEJNÍ PROCES**

#### **A) Typy objednávek:**
- [ ] **Jen jednorázové objednávky nebo i opakující?**
  - Příklad: Měsíční dodávka kancelářských potřeb
  - Dopad: Potřebujeme subscription/recurring logic?

- [ ] **B2B pouze nebo i B2C zákazníci?**
  - B2B: Faktury, platební lhůty, slevy podle množství
  - B2C: Okamžité platby, jiné daňové požadavky
  - Dopad: Různé order workflows

- [ ] **Schvalovací proces objednávek?**
  - Příklad: Objednávky nad 50,000 Kč musí schválit manager
  - Dopad: Workflow states, notifications

#### **B) Pricing & Money:**
- [ ] **Jen CZK nebo i EUR/USD?**
  - Dopad: Currency conversion, exchange rates
  
- [ ] **Slevy - jak fungují?**
  - Na úrovni objednávky (10% z celkového)
  - Na úrovni položky (každý produkt jinak)
  - Quantity discounts (čím více, tím levnější)
  - Customer discounts (VIP zákazníci)
  
- [ ] **DPH - jak složité?**
  - Jen standardních 21%?
  - Snížená sazba 15% pro některé produkty?
  - EU intrastat pro mezinárodní?
  - Reverse charge?

#### **C) Order Fulfillment:**
- [ ] **Fyzické produkty, digitální, nebo služby?**
  - Fyzické: Shipping, inventory tracking
  - Digitální: Download links, licenses
  - Služby: Scheduling, time tracking
  
- [ ] **Shipping proces?**
  - Vlastní doprava vs externí (DPD, PPL, Zásilkovna)
  - Tracking numbers integration
  - Shipping cost calculation

### **📞 2. CUSTOMERS & CRM**

#### **A) Customer Types:**
- [ ] **Individual companies vs corporate groups?**
  - Příklad: Kaufland = parent, jednotlivé pobočky = children
  - Dopad: Hierarchical customer structure
  
- [ ] **Kolik kontaktů na zákazníka?**  
  - Jen 1 kontakt (simple)
  - Multiple contacts (nákupčí, účetní, manager)
  - Dopad: Contacts management system

#### **B) Customer Relationship:**
- [ ] **Customer segments/categories?**
  - Příklad: Bronze, Silver, Gold, Platinum
  - Různé ceny, slevy, priorita
  - Dopad: Pricing tiers, service levels
  
- [ ] **Credit limits a payment terms?**
  - 14 dní standard, ale VIP zákazníci 30 dní?
  - Credit limit kontrola před objednávkou?
  - Dopad: Financial risk management

### **🛍️ 3. PRODUCTS & INVENTORY**

#### **A) Product Complexity:**
- [ ] **Jednoduchý katalog nebo komplexní?**
  - Simple: Název, cena, popis
  - Complex: Varianty (velikost, barva), bundles, configurace
  
- [ ] **Inventory tracking?**
  - Jen zobrazení "skladem/není skladem"
  - Přesné množství na skladě  
  - Rezervace při objednávce
  - Multiple warehouses
  
- [ ] **Product categories?**
  - Flat list vs hierarchical tree
  - Dopad: Navigation, search, reporting

#### **B) Pricing Strategy:**
- [ ] **Customer-specific pricing?**
  - VIP zákazník má jinou cenu než standard
  - Volume discounts based on history
  - Dopad: Complex pricing engine

### **💰 4. BILLING & PAYMENTS**

#### **A) Invoicing:**
- [ ] **Kdy se generují faktury?**
  - Při objednávce (proforma)
  - Při expedici (tax invoice)
  - Periodicky (monthly billing)
  
- [ ] **Invoice numbering system?**
  - Sequential per year: 2025/001, 2025/002...
  - Per customer: KAU-001, VOD-001...
  - Dopad: Legal compliance requirements

#### **B) Payment Tracking:**
- [ ] **Payment methods podporované?**
  - Bank transfer (most common in B2B)
  - Card payments (Stripe integration)
  - Cash on delivery
  - Invoice/terms (pay later)
  
- [ ] **Partial payments support?**
  - Customer platí 50% dopředu, 50% při dodání
  - Dopad: Payment reconciliation complexity

### **📊 5. REPORTING & ANALYTICS**

#### **A) Business Metrics:**
- [ ] **Jaké KPIs potřebujete sledovat?**
  - Sales revenue by period
  - Customer acquisition cost
  - Average order value
  - Customer lifetime value
  - Product profitability
  
- [ ] **Reporting frequency?**
  - Real-time dashboards
  - Daily/weekly/monthly reports
  - Year-end financial summaries

#### **B) Compliance:**
- [ ] **Audit trail requirements?**
  - Who changed what when (GDPR compliance)
  - Financial audit trail
  - Tax authority requirements

---

## 🎯 **IMPACT ASSESSMENT**

### **🟢 LOW IMPACT DECISIONS:**
*Lze změnit i později bez velkých problémů*
- UI texty a labels
- Report formátování
- Email templates
- Color schemes

### **🟡 MEDIUM IMPACT DECISIONS:**
*Změna vyžaduje 1-2 týdny práce*
- Order status workflows
- Payment method options
- Customer field requirements
- Product categorization

### **🔴 HIGH IMPACT DECISIONS:**
*Změna vyžaduje měsíce přepracování*
- Currency support (single vs multi)
- B2B vs B2C architecture
- Inventory tracking (yes/no)
- Customer hierarchy (flat vs tree)
- Pricing complexity (simple vs complex)

### **💀 NIGHTMARE DECISIONS:**
*Změna vyžaduje rebuild velkých částí systému*
- Database schema fundamentals
- Single-tenant vs multi-tenant
- Monolithic vs microservices (již rozhodnuto)
- Technology stack changes

---

## 📋 **SESSION AGENDA**

### **ČÁST 1: Order Management (30 min)**
- Probrat všechny order-related otázky výše
- Definovat order lifecycle states
- Rozhodnout o pricing complexity
- Specifikovat fulfillment process

### **ČÁST 2: Customer Management (20 min)**  
- Customer types a hierarchy
- Contact management
- Segmentation requirements
- Credit/payment terms

### **ČÁST 3: Products & Inventory (20 min)**
- Product catalog complexity
- Inventory tracking requirements
- Category structure
- Pricing strategies

### **ČÁST 4: Financial Management (20 min)**
- Invoicing requirements
- Payment method support
- Tax calculation needs
- Currency requirements

### **ČÁST 5: Reporting & Compliance (10 min)**
- Key metrics identification
- Compliance requirements
- Audit trail needs

---

## 📝 **DELIVERABLES Z TOHOTO SEZENÍ**

### **1. BUSINESS REQUIREMENTS DOCUMENT (BRD)**
- Detailní specifikace všech business rules
- Priority matrix (Must-have vs Nice-to-have)
- User stories pro každý workflow
- Acceptance criteria definition

### **2. DATABASE SCHEMA UPDATES**
- Required schema changes based on requirements
- New tables/columns needed
- Index optimization plan
- Migration strategy

### **3. API SPECIFICATION UPDATES**
- New endpoints required
- Modified response formats
- Authentication/authorization rules
- Integration requirements

### **4. IMPLEMENTATION ROADMAP**
- What to implement in current backend phase
- What to defer to future releases
- Dependencies between features
- Timeline adjustments

---

## ⚠️ **ROZHODOVACÍ FRAMEWORK**

### **PRO KAŽDÉ ROZHODNUTÍ SE PTEJTE:**
1. **Je to core business requirement nebo nice-to-have?**
2. **Kolik zákazníků to ovlivní?**
3. **Jak často se to používá?**
4. **Lze to přidat později bez velkého dopadu?**
5. **Jaká je implementation complexity?**

### **DECISION MATRIX:**
```
HIGH Priority = Core Business + High Usage + Hard to Change Later
MEDIUM Priority = Important Business + Medium Usage + Medium Change Cost  
LOW Priority = Nice-to-Have + Low Usage + Easy to Change Later
DEFER = Non-essential + Low Usage + No Immediate Business Value
```

---

## 🚀 **NEXT STEPS PO SEZENÍ**

### **IMMEDIATE (1-2 dny):**
- [ ] Dokumentovat všechna rozhodnutí z session
- [ ] Update DATABASE_DESIGN_FINALIZATION.md s novými requirements
- [ ] Vytvořit implementation plan pro backend updates
- [ ] Estimate timeline impact

### **SHORT TERM (1 týden):**
- [ ] Implementovat critical schema changes
- [ ] Update API specifications
- [ ] Create test scenarios pro nové requirements
- [ ] Validate changes s business stakeholders

### **MEDIUM TERM (2-3 týdny):**
- [ ] Complete backend implementation updates
- [ ] Full integration testing s novými features
- [ ] Performance testing s complex scenarios
- [ ] Documentation update

---

**🎯 CÍL: Mít 100% jasno o tom, co aplikace musí umět, než začneme frontend!**

**Každá hodina strávená v tomto sezení = dny ušetřené v budoucnosti.** ⏰💰