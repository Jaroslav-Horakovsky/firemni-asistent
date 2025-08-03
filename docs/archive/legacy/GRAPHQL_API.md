# GraphQL API Design - Firemní Asistent

## Apollo Federation Architecture

Aplikace používá Apollo Federation v2 pro kompozici GraphQL schématu z více mikroslužeb. Každá služba definuje svou část globálního datového grafu a API Gateway (Apollo Router) je inteligentně skládá dohromady.

---

## Service Schemas

### 1. User Service Schema

**Odpovědnost**: Autentizace, autorizace, správa uživatelů

```graphql
# user-service/schema.graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

type Query {
  """Získat aktuálně přihlášeného uživatele"""
  me: User
  
  """Získat uživatele podle ID"""
  user(id: ID!): User
  
  """Seznam všech uživatelů (pouze pro majitele)"""
  users(filter: UserFilter): [User!]!
}

type Mutation {
  """Registrace nového uživatele"""
  register(input: RegisterInput!): AuthPayload!
  
  """Přihlášení uživatele"""
  login(input: LoginInput!): AuthPayload!
  
  """Odhlášení uživatele"""
  logout: Boolean!
  
  """Aktualizace profilu uživatele"""
  updateProfile(input: UpdateProfileInput!): User!
  
  """Změna hesla"""
  changePassword(input: ChangePasswordInput!): Boolean!
  
  """Reset hesla"""
  resetPassword(email: String!): Boolean!
}

"""Uživatel systému"""
type User @key(fields: "id") {
  id: ID!
  email: String!
  firstName: String!
  lastName: String!
  fullName: String! # Computed field: firstName + lastName
  role: UserRole!
  hourlyRate: Float
  isActive: Boolean!
  avatar: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

"""Role uživatele v systému"""
enum UserRole {
  OWNER
  EMPLOYEE  
  CONTRACTOR
}

"""Vstup pro registraci"""
input RegisterInput {
  email: String!
  password: String!
  firstName: String!
  lastName: String!
  role: UserRole!
  hourlyRate: Float
}

"""Vstup pro přihlášení"""
input LoginInput {
  email: String!
  password: String!
}

"""Vstup pro aktualizaci profilu"""
input UpdateProfileInput {
  firstName: String
  lastName: String
  hourlyRate: Float
  avatar: String
}

"""Vstup pro změnu hesla"""
input ChangePasswordInput {
  currentPassword: String!
  newPassword: String!
}

"""Filtr pro uživatele"""
input UserFilter {
  role: UserRole
  isActive: Boolean
  search: String
}

"""Odpověď s autentizačními údaji"""
type AuthPayload {
  user: User!
  token: String!
  expiresAt: DateTime!
}

"""DateTime scalar type"""
scalar DateTime
```

### 2. Customer Service Schema

**Odpovědnost**: Správa zákazníků a klientů

```graphql
# customer-service/schema.graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

type Query {
  """Získat zákazníka podle ID"""
  customer(id: ID!): Customer
  
  """Seznam zákazníků"""
  customers(filter: CustomerFilter, pagination: PaginationInput): CustomerConnection!
  
  """Vyhledat zákazníky"""
  searchCustomers(query: String!): [Customer!]!
}

type Mutation {
  """Vytvořit nového zákazníka"""
  createCustomer(input: CreateCustomerInput!): Customer!
  
  """Aktualizovat zákazníka"""
  updateCustomer(id: ID!, input: UpdateCustomerInput!): Customer!
  
  """Smazat zákazníka"""
  deleteCustomer(id: ID!): Boolean!
  
  """Přidat kontaktní osobu"""
  addContact(customerId: ID!, input: ContactInput!): Contact!
}

"""Zákazník (firma nebo jednotlivec)"""
type Customer @key(fields: "id") {
  id: ID!
  name: String! # Název firmy nebo jméno jednotlivce
  type: CustomerType!
  ico: String
  dic: String
  billingAddress: Address!
  email: String!
  phone: String
  paymentTerms: Int! # Splatnost ve dnech
  isActive: Boolean!
  notes: String
  contacts: [Contact!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

"""Typ zákazníka"""
enum CustomerType {
  INDIVIDUAL
  COMPANY
}

"""Adresa"""
type Address {
  street: String!
  city: String!
  postalCode: String!
  country: String!
}

"""Kontaktní osoba"""
type Contact {
  id: ID!
  name: String!
  position: String
  email: String
  phone: String
  isPrimary: Boolean!
}

"""Vstup pro vytvoření zákazníka"""
input CreateCustomerInput {
  name: String!
  type: CustomerType!
  ico: String
  dic: String
  billingAddress: AddressInput!
  email: String!
  phone: String
  paymentTerms: Int = 14
  notes: String
}

"""Vstup pro aktualizaci zákazníka"""
input UpdateCustomerInput {
  name: String
  ico: String
  dic: String  
  billingAddress: AddressInput
  email: String
  phone: String
  paymentTerms: Int
  notes: String
  isActive: Boolean
}

"""Vstup pro adresu"""
input AddressInput {
  street: String!
  city: String!
  postalCode: String!
  country: String!
}

"""Vstup pro kontaktní osobu"""
input ContactInput {
  name: String!
  position: String
  email: String
  phone: String
  isPrimary: Boolean = false
}

"""Filtr pro zákazníky"""
input CustomerFilter {
  type: CustomerType
  isActive: Boolean
  search: String
}

"""Vstup pro stránkování"""
input PaginationInput {
  first: Int = 20
  after: String
}

"""Připojení zákazníků s stránkováním"""
type CustomerConnection {
  edges: [CustomerEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type CustomerEdge {
  node: Customer!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

scalar DateTime
```

### 3. Order Service Schema

**Odpovědnost**: Správa zakázek, přiřazování práce a materiálu

```graphql
# order-service/schema.graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@external", "@requires"])

type Query {
  """Získat zakázku podle ID"""
  order(id: ID!): Order
  
  """Seznam zakázek"""
  orders(filter: OrderFilter, pagination: PaginationInput): OrderConnection!
  
  """Statistiky zakázek"""
  orderStats: OrderStats!
}

type Mutation {
  """Vytvořit novou zakázku"""
  createOrder(input: CreateOrderInput!): Order!
  
  """Aktualizovat zakázku"""
  updateOrder(id: ID!, input: UpdateOrderInput!): Order!
  
  """Dokončit zakázku"""
  completeOrder(id: ID!): Order!
  
  """Přiřadit pracovníka k zakázce"""
  assignWorker(orderId: ID!, userId: ID!): Order!
  
  """Odebrat pracovníka ze zakázky"""
  unassignWorker(orderId: ID!, userId: ID!): Order!
  
  """Přidat práci k zakázce"""
  addWorkEntry(input: AddWorkEntryInput!): WorkEntry!
  
  """Přidat materiál k zakázce"""
  addMaterialEntry(input: AddMaterialEntryInput!): MaterialEntry!
}

"""Zakázka"""
type Order @key(fields: "id") {
  id: ID!
  title: String!
  description: String
  status: OrderStatus!
  estimatedBudget: Float
  actualCost: Float!
  totalRevenue: Float!
  profitMargin: Float! # Vypočtené pole
  
  # Reference na jiné služby
  customer: Customer! # Bude vyřešeno Customer Service
  createdBy: User! # Bude vyřešeno User Service
  assignedWorkers: [User!]! # Bude vyřešeno User Service
  
  # Práce a materiál
  workEntries: [WorkEntry!]!
  materialEntries: [MaterialEntry!]!
  
  createdAt: DateTime!
  updatedAt: DateTime!
  completedAt: DateTime
}

"""Stav zakázky"""
enum OrderStatus {
  ACTIVE
  COMPLETED
  INVOICED
  CANCELLED
}

"""Záznam práce"""
type WorkEntry {
  id: ID!
  orderId: ID!
  worker: User! # Reference na User Service
  workType: String!
  hoursWorked: Float!
  hourlyRate: Float!
  totalCost: Float! # hoursWorked * hourlyRate
  description: String
  createdAt: DateTime!
}

"""Záznam materiálu"""
type MaterialEntry {
  id: ID!
  orderId: ID!
  material: Material! # Reference na Inventory Service
  quantity: Float!
  unitCost: Float!
  totalCost: Float! # quantity * unitCost
  addedBy: User! # Reference na User Service
  createdAt: DateTime!
}

"""Rozšíření User typu o zakázky"""
extend type User @key(fields: "id") {
  id: ID! @external
  
  """Zakázky kde je uživatel přiřazen"""
  assignedOrders: [Order!]!
  
  """Zakázky vytvořené uživatelem"""
  createdOrders: [Order!]!
  
  """Záznamy práce uživatele"""
  workEntries(dateFrom: DateTime, dateTo: DateTime): [WorkEntry!]!
}

"""Rozšíření Customer typu o zakázky"""
extend type Customer @key(fields: "id") {
  id: ID! @external
  
  """Zakázky zákazníka"""
  orders: [Order!]!
  
  """Celková hodnota zakázek"""
  totalOrderValue: Float!
}

"""Vstup pro vytvoření zakázky"""
input CreateOrderInput {
  title: String!
  description: String
  customerId: ID!
  estimatedBudget: Float
  assignedWorkerIds: [ID!] = []
}

"""Vstup pro aktualizaci zakázky"""
input UpdateOrderInput {
  title: String
  description: String
  estimatedBudget: Float
  status: OrderStatus
}

"""Vstup pro přidání práce"""
input AddWorkEntryInput {
  orderId: ID!
  workType: String!
  hoursWorked: Float!
  hourlyRate: Float!
  description: String
}

"""Vstup pro přidání materiálu"""
input AddMaterialEntryInput {
  orderId: ID!
  materialId: ID!
  quantity: Float!
  unitCost: Float!
}

"""Filtr pro zakázky"""
input OrderFilter {
  status: OrderStatus
  customerId: ID
  assignedWorkerId: ID
  dateFrom: DateTime
  dateTo: DateTime
}

"""Připojení zakázek s stránkováním"""
type OrderConnection {
  edges: [OrderEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type OrderEdge {
  node: Order!
  cursor: String!
}

"""Statistiky zakázek"""
type OrderStats {
  totalOrders: Int!
  activeOrders: Int!
  completedOrders: Int!
  totalRevenue: Float!
  averageOrderValue: Float!
  profitMargin: Float!
}

# Import typů z jiných služeb
type Customer @key(fields: "id") {
  id: ID!
}

type User @key(fields: "id") {
  id: ID!
}

type Material @key(fields: "id") {
  id: ID!
}

scalar DateTime
```

### 4. Inventory Service Schema

**Odpovědnost**: Správa skladu, materiálu a dodavatelů

```graphql
# inventory-service/schema.graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])

type Query {
  """Získat materiál podle ID"""
  material(id: ID!): Material
  
  """Seznam materiálů"""
  materials(filter: MaterialFilter): [Material!]!
  
  """Materiály s nízkou zásobou"""
  lowStockMaterials: [Material!]!
  
  """Získat dodavatele podle ID"""
  supplier(id: ID!): Supplier
  
  """Seznam dodavatelů"""
  suppliers: [Supplier!]!
  
  """Skladové statistiky"""
  inventoryStats: InventoryStats!
}

type Mutation {
  """Přidat nový materiál"""
  createMaterial(input: CreateMaterialInput!): Material!
  
  """Aktualizovat materiál"""
  updateMaterial(id: ID!, input: UpdateMaterialInput!): Material!
  
  """Aktualizovat stav skladu"""
  updateStock(id: ID!, quantity: Float!, type: StockMovementType!, note: String): StockMovement!
  
  """Vytvořit dodavatele"""
  createSupplier(input: CreateSupplierInput!): Supplier!
  
  """Aktualizovat dodavatele"""
  updateSupplier(id: ID!, input: UpdateSupplierInput!): Supplier!
}

"""Materiál na skladě"""
type Material @key(fields: "id") {
  id: ID!
  code: String! # SKU/kód materiálu
  name: String!
  description: String
  unit: String! # ks, m, m2, kg, l
  currentStock: Float!
  minStock: Float!
  isLowStock: Boolean! # Computed: currentStock <= minStock
  purchasePrice: Float!
  salePrice: Float!
  supplier: Supplier
  location: String # Umístění ve skladu
  stockMovements: [StockMovement!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

"""Pohyb skladu"""
type StockMovement {
  id: ID!
  materialId: ID!
  type: StockMovementType!
  quantity: Float!
  previousStock: Float!
  newStock: Float!
  note: String
  createdBy: User! # Reference na User Service
  createdAt: DateTime!
}

"""Typ pohybu skladu"""
enum StockMovementType {
  IN        # Naskladnění
  OUT       # Vyskladnění
  ADJUSTMENT # Inventura/oprava
  RESERVED   # Rezervace pro zakázku
  RELEASED   # Uvolnění rezervace
}

"""Dodavatel"""
type Supplier @key(fields: "id") {
  id: ID!
  name: String!
  ico: String
  dic: String
  address: Address!
  contactPerson: String
  email: String
  phone: String
  website: String
  paymentTerms: Int!
  isActive: Boolean!
  materials: [Material!]! # Materiály od tohoto dodavatele
  notes: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

"""Vstup pro vytvoření materiálu"""
input CreateMaterialInput {
  code: String!
  name: String!
  description: String
  unit: String!
  minStock: Float = 0
  purchasePrice: Float!
  salePrice: Float!
  supplierId: ID
  location: String
}

"""Vstup pro aktualizaci materiálu"""
input UpdateMaterialInput {
  code: String
  name: String
  description: String
  unit: String
  minStock: Float
  purchasePrice: Float
  salePrice: Float
  supplierId: ID
  location: String
}

"""Vstup pro vytvoření dodavatele"""
input CreateSupplierInput {
  name: String!
  ico: String
  dic: String
  address: AddressInput!
  contactPerson: String
  email: String
  phone: String
  website: String
  paymentTerms: Int = 30
  notes: String
}

"""Vstup pro aktualizaci dodavatele"""
input UpdateSupplierInput {
  name: String
  ico: String
  dic: String
  address: AddressInput
  contactPerson: String
  email: String
  phone: String
  website: String
  paymentTerms: Int
  isActive: Boolean
  notes: String
}

"""Filtr pro materiály"""
input MaterialFilter {
  search: String
  supplierId: ID
  lowStock: Boolean
  unit: String
}

"""Skladové statistiky"""
type InventoryStats {
  totalMaterials: Int!
  lowStockItems: Int!
  totalInventoryValue: Float!
  topMaterials: [MaterialUsageStats!]!
}

"""Statistiky použití materiálu"""
type MaterialUsageStats {
  material: Material!
  totalUsed: Float!
  totalValue: Float!
}

# Import typů
type User @key(fields: "id") {
  id: ID!
}

type Address {
  street: String!
  city: String!
  postalCode: String!
  country: String!
}

input AddressInput {
  street: String!
  city: String!
  postalCode: String!
  country: String!
}

scalar DateTime
```

### 5. Billing Service Schema

**Odpovědnost**: Fakturace a platby

```graphql
# billing-service/schema.graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@external"])

type Query {
  """Získat fakturu podle ID"""
  invoice(id: ID!): Invoice
  
  """Seznam faktur"""
  invoices(filter: InvoiceFilter): [Invoice!]!
  
  """Finanční přehled"""
  financialSummary(dateFrom: DateTime, dateTo: DateTime): FinancialSummary!
}

type Mutation {
  """Vygenerovat fakturu ze zakázky"""
  generateInvoice(orderId: ID!): Invoice!
  
  """Aktualizovat stav faktury"""
  updateInvoiceStatus(id: ID!, status: InvoiceStatus!): Invoice!
  
  """Export faktury do PDF"""
  exportInvoicePDF(id: ID!): InvoiceExport!
}

"""Faktura"""
type Invoice @key(fields: "id") {
  id: ID!
  number: String! # Číslo faktury
  order: Order! # Reference na Order Service
  customer: Customer! # Reference na Customer Service
  status: InvoiceStatus!
  issueDate: DateTime!
  dueDate: DateTime!
  paidDate: DateTime
  
  # Finanční údaje (snapshot z doby vytvoření)
  subtotal: Float!
  vatRate: Float!
  vatAmount: Float!
  total: Float!
  
  # Položky faktury
  lineItems: [InvoiceLineItem!]!
  
  # Platební údaje
  paymentMethod: String
  bankAccount: String
  variableSymbol: String!
  
  notes: String
  createdBy: User! # Reference na User Service
  createdAt: DateTime!
  updatedAt: DateTime!
}

"""Stav faktury"""
enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  CANCELLED
}

"""Položka faktury"""
type InvoiceLineItem {
  id: ID!
  description: String!
  quantity: Float!
  unitPrice: Float!
  total: Float!
  vatRate: Float!
}

"""Export faktury"""
type InvoiceExport {
  url: String! # URL na PDF soubor
  expiresAt: DateTime!
}

"""Rozšíření Order typu o fakturu"""
extend type Order @key(fields: "id") {
  id: ID! @external
  
  """Faktura pro tuto zakázku"""
  invoice: Invoice
}

"""Rozšíření Customer typu o faktury"""
extend type Customer @key(fields: "id") {
  id: ID! @external
  
  """Faktury zákazníka"""
  invoices: [Invoice!]!
  
  """Celková hodnota faktur"""
  totalInvoiceAmount: Float!
  
  """Nesplacené faktury"""
  unpaidInvoices: [Invoice!]!
}

"""Filtr pro faktury"""
input InvoiceFilter {
  status: InvoiceStatus
  customerId: ID
  dateFrom: DateTime
  dateTo: DateTime
  overdue: Boolean
}

"""Finanční přehled"""
type FinancialSummary {
  totalRevenue: Float!
  totalPaid: Float!
  totalUnpaid: Float!
  overdueAmount: Float!
  averagePaymentTime: Float! # Ve dnech
  revenueByMonth: [MonthlyRevenue!]!
}

"""Měsíční příjmy"""
type MonthlyRevenue {
  month: String! # YYYY-MM
  revenue: Float!
  invoiceCount: Int!
}

# Import typů
type Order @key(fields: "id") {
  id: ID!
}

type Customer @key(fields: "id") {
  id: ID!
}

type User @key(fields: "id") {
  id: ID!
}

scalar DateTime
```

### 6. Notification Service Schema

**Odpovědnost**: Notifikace a komunikace

```graphql
# notification-service/schema.graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@external"])

type Query {
  """Notifikace pro aktuálního uživatele"""
  myNotifications(filter: NotificationFilter): [Notification!]!
  
  """Počet nepřečtených notifikací"""
  unreadNotificationCount: Int!
}

type Mutation {
  """Označit notifikaci jako přečtenou"""
  markAsRead(id: ID!): Notification!
  
  """Označit všechny notifikace jako přečtené"""
  markAllAsRead: Boolean!
  
  """Smazat notifikaci"""
  deleteNotification(id: ID!): Boolean!
  
  """Poslat custom notifikaci"""
  sendNotification(input: SendNotificationInput!): Notification!
}

type Subscription {
  """Nové notifikace pro uživatele"""
  notificationAdded(userId: ID!): Notification!
}

"""Notifikace"""
type Notification @key(fields: "id") {
  id: ID!
  recipient: User! # Reference na User Service
  type: NotificationType!
  title: String!
  message: String!
  data: NotificationData # JSON data pro specifické typy
  isRead: Boolean!
  createdAt: DateTime!
  readAt: DateTime
}

"""Typ notifikace"""
enum NotificationType {
  ORDER_CREATED
  ORDER_COMPLETED
  ORDER_ASSIGNED
  INVOICE_GENERATED
  INVOICE_PAID
  INVOICE_OVERDUE
  LOW_STOCK_ALERT
  USER_MENTION
  SYSTEM_ALERT
}

"""Data notifikace (JSON)"""
scalar NotificationData

"""Rozšíření User typu o notifikace"""
extend type User @key(fields: "id") {
  id: ID! @external
  
  """Notifikace uživatele"""
  notifications(limit: Int = 20): [Notification!]!
  
  """Počet nepřečtených notifikací"""
  unreadNotificationCount: Int!
}

"""Vstup pro odeslání notifikace"""
input SendNotificationInput {
  recipientId: ID!
  type: NotificationType!
  title: String!
  message: String!
  data: NotificationData
}

"""Filtr pro notifikace"""
input NotificationFilter {
  type: NotificationType
  isRead: Boolean
  dateFrom: DateTime
  dateTo: DateTime
}

# Import typů
type User @key(fields: "id") {
  id: ID!
}

scalar DateTime
```

---

## Federation Gateway Configuration

### Apollo Router Configuration

```yaml
# router.yaml
supergraph:
  # Cesta k federovanému schématu
  path: ./supergraph-schema.graphql

headers:
  all:
    request:
      - propagate:
          named: "authorization"
      - propagate:
          named: "x-user-id"
      - propagate:
          named: "x-correlation-id"

cors:
  origins:
    - https://app.firemni-asistent.cz
    - https://staging.firemni-asistent.cz
    - http://localhost:3000  # Development
  allow_credentials: true

limits:
  max_depth: 15
  max_aliases: 30
  max_root_fields: 20

authentication:
  router:
    jwt:
      jwks:
        - url: https://user-service.run.app/.well-known/jwks.json
      header_name: authorization
      header_value_prefix: "Bearer "

authorization:
  require_authentication: true
  directives:
    authenticated: |
      directive @authenticated on FIELD_DEFINITION

  compose:
    mode: new

telemetry:
  apollo:
    graph_ref: "firemni-asistent@current" 
    schema_reporting:
      enabled: true
    usage_reporting:
      enabled: true
  
  metrics:
    prometheus:
      enabled: true
      listen: 0.0.0.0:9090
      path: /metrics

  tracing:
    jaeger:
      enabled: true
      endpoint: "http://jaeger:14268/api/traces"
```

### Schema Composition Script

```typescript
// scripts/compose-schema.ts
import { IntrospectAndCompose } from '@apollo/composition';
import { writeFileSync } from 'fs';

async function composeSchema() {
  const services = [
    { name: 'user-service', url: 'http://localhost:3001/graphql' },
    { name: 'customer-service', url: 'http://localhost:3002/graphql' },
    { name: 'order-service', url: 'http://localhost:3003/graphql' },
    { name: 'inventory-service', url: 'http://localhost:3004/graphql' },
    { name: 'billing-service', url: 'http://localhost:3005/graphql' },
    { name: 'notification-service', url: 'http://localhost:3006/graphql' },
  ];

  const result = await IntrospectAndCompose({
    subgraphs: services,
  });

  if (result.errors && result.errors.length > 0) {
    console.error('Composition errors:', result.errors);
    process.exit(1);
  }

  // Uložit kompozitní schéma
  writeFileSync('./supergraph-schema.graphql', result.supergraphSdl);
  console.log('✅ Schema composed successfully');
}

composeSchema().catch(console.error);
```

---

## Query Examples

### Komplexní dotazy přes federation

```graphql
# Získat přehled zakázky s kompletními daty
query GetOrderOverview($orderId: ID!) {
  order(id: $orderId) {
    id
    title
    status
    actualCost
    totalRevenue
    profitMargin
    
    # Data ze Customer Service
    customer {
      id
      name
      email
      paymentTerms
    }
    
    # Data z User Service
    createdBy {
      id
      fullName
      email
    }
    
    assignedWorkers {
      id
      fullName
      hourlyRate
    }
    
    # Lokální data Order Service
    workEntries {
      id
      workType
      hoursWorked
      hourlyRate
      totalCost
      worker {
        fullName
      }
    }
    
    materialEntries {
      id
      quantity
      unitCost
      totalCost
      material {
        name
        unit
      }
    }
    
    # Data z Billing Service
    invoice {
      id
      number
      status
      total
      dueDate
    }
  }
}

# Dashboard query - kombinuje data z více služeb
query GetDashboard {
  # Order Service
  orderStats {
    totalOrders
    activeOrders
    totalRevenue
    profitMargin
  }
  
  # Billing Service
  financialSummary(dateFrom: "2024-01-01T00:00:00Z") {
    totalRevenue
    totalPaid
    overdueAmount
  }
  
  # Inventory Service
  inventoryStats {
    lowStockItems
    totalInventoryValue
  }
  
  # User Service
  me {
    fullName
    unreadNotificationCount
  }
  
  # Recent activities
  orders(filter: { status: ACTIVE }) {
    edges {
      node {
        id
        title
        customer {
          name
        }
        actualCost
      }
    }
  }
}

# User profile s kompletními daty
query GetUserProfile($userId: ID!) {
  user(id: $userId) {
    id
    fullName
    email
    role
    hourlyRate
    
    # Data z Order Service
    assignedOrders {
      id
      title
      status
      customer {
        name
      }
    }
    
    workEntries(dateFrom: "2024-01-01T00:00:00Z") {
      id
      workType
      hoursWorked
      totalCost
      createdAt
    }
    
    # Data z Notification Service
    notifications(limit: 10) {
      id
      title
      message
      type
      isRead
      createdAt
    }
  }
}
```

### Mutations s cross-service závislostmi

```graphql
# Vytvoření kompletní zakázky
mutation CreateCompleteOrder($input: CreateOrderInput!) {
  createOrder(input: $input) {
    id
    title
    status
    customer {
      name
      email
    }
    assignedWorkers {
      fullName
      email
    }
  }
}

# Dokončení zakázky s automatickou fakturací
mutation CompleteOrderWithInvoice($orderId: ID!) {
  completeOrder(id: $orderId) {
    id
    status
    completedAt
    
    # Faktura bude vygenerována automaticky přes event
    invoice {
      id
      number
      total
      dueDate
    }
  }
}
```

---

## Error Handling

### Custom Error Types

```typescript
// shared/errors.ts
import { GraphQLError } from 'graphql';

export class ValidationError extends GraphQLError {
  constructor(message: string, field?: string) {
    super(message, {
      extensions: {
        code: 'VALIDATION_ERROR',
        field,
      },
    });
  }
}

export class AuthenticationError extends GraphQLError {
  constructor(message = 'Authentication required') {
    super(message, {
      extensions: {
        code: 'AUTHENTICATION_ERROR',
      },
    });
  }
}

export class ForbiddenError extends GraphQLError {
  constructor(message = 'Insufficient permissions') {
    super(message, {
      extensions: {
        code: 'FORBIDDEN',
      },
    });
  }
}

export class NotFoundError extends GraphQLError {
  constructor(resource: string) {
    super(`${resource} not found`, {
      extensions: {
        code: 'NOT_FOUND',
        resource,
      },
    });
  }
}
```

### Federation Error Handling

```typescript
// gateway/error-formatter.ts
export function formatError(err: GraphQLError) {
  // Remove stack trace in production
  if (process.env.NODE_ENV === 'production') {
    delete err.extensions?.exception?.stacktrace;
  }

  // Add correlation ID for debugging
  if (!err.extensions?.correlationId) {
    err.extensions = {
      ...err.extensions,
      correlationId: generateCorrelationId(),
    };
  }

  // Structured error logging
  logger.error('GraphQL Error', {
    message: err.message,
    path: err.path,
    locations: err.locations,
    extensions: err.extensions,
  });

  return err;
}
```

---

## Performance Optimizations

### Query Complexity Analysis

```typescript
// gateway/query-complexity.ts
import { createComplexityLimitRule } from 'graphql-query-complexity';

export const complexityLimitRule = createComplexityLimitRule(1000, {
  scalarCost: 1,
  objectCost: 2,
  listFactor: 10,
  introspectionCost: 1000,
  createError: (max, actual) => {
    return new Error(`Query is too complex: ${actual}. Maximum allowed complexity: ${max}`);
  },
});
```

### DataLoader Implementation

```typescript
// shared/data-loaders.ts
import DataLoader from 'dataloader';

// User DataLoader (pro Order Service)
export const createUserLoader = () => {
  return new DataLoader<string, User>(async (userIds) => {
    const response = await fetch('http://user-service/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetUsers($ids: [ID!]!) {
            users(filter: { ids: $ids }) {
              id
              fullName
              email
              hourlyRate
            }
          }
        `,
        variables: { ids: userIds },
      }),
    });
    
    const { data } = await response.json();
    
    // Zaručit správné pořadí
    return userIds.map(id => 
      data.users.find((user: User) => user.id === id)
    );
  });
};
```

Tento GraphQL API design poskytuje silnou typovou bezpečnost, flexibilní dotazování a optimální výkon při zachování jasných hranic mezi mikroslužbami.