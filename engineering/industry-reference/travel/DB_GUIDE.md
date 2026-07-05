# Travel & Tours — Database Guide
# Get4Domain Engineering Standard v1.0
# Status: TEMPLATE — Fill after MR_TRAVELS_001 P003 is complete

---

## Standard Prisma Rules (all models)

Every model must have:
```prisma
id        String    @id @default(uuid())
createdAt DateTime  @default(now())
updatedAt DateTime  @updatedAt
deletedAt DateTime?               // soft delete — never hard delete
```

---

## Model Reference (Travel Standard)

### User
```prisma
model User {
  id               String    @id @default(uuid())
  email            String    @unique
  password         String                          // bcrypt hashed
  firstName        String
  lastName         String
  phone            String?
  role             UserRole  @default(STAFF)
  isActive         Boolean   @default(true)
  refreshTokenHash String?                         // hashed refresh token
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?
  bookings         Booking[]
}

enum UserRole {
  SUPER_ADMIN
  ADMIN
  MANAGER
  STAFF
  DRIVER
  CLIENT
}
```

### TourPackage
```prisma
model TourPackage {
  id          String      @id @default(uuid())
  name        String
  description String?
  type        PackageType
  duration    Int                                  // in days
  inclusions  String[]
  basePrice   Decimal     @db.Decimal(10, 2)
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  deletedAt   DateTime?
  bookings    Booking[]
}

enum PackageType {
  LOCAL
  PILGRIMAGE
  CORPORATE
  CUSTOM
}
```

### Vehicle
```prisma
model Vehicle {
  id              String        @id @default(uuid())
  registrationNo  String        @unique
  type            VehicleType
  make            String
  model           String
  year            Int
  capacity        Int
  isAC            Boolean       @default(false)
  status          VehicleStatus @default(AVAILABLE)
  insuranceExpiry DateTime
  permitExpiry    DateTime
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  deletedAt       DateTime?
  bookings        Booking[]
  tripSheets      TripSheet[]
}

enum VehicleType {
  SEDAN
  SUV
  TEMPO_TRAVELLER
  MINI_BUS
  BUS
}

enum VehicleStatus {
  AVAILABLE
  ON_TRIP
  MAINTENANCE
  INACTIVE
}
```

### Driver
```prisma
model Driver {
  id            String       @id @default(uuid())
  name          String
  licenseNo     String       @unique
  licenseExpiry DateTime
  phone         String       @unique
  address       String?
  joiningDate   DateTime
  status        DriverStatus @default(AVAILABLE)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  deletedAt     DateTime?
  bookings      Booking[]
  tripSheets    TripSheet[]
}

enum DriverStatus {
  AVAILABLE
  ON_TRIP
  LEAVE
  INACTIVE
}
```

### Booking
```prisma
model Booking {
  id            String        @id @default(uuid())
  bookingNo     String        @unique                // auto-generated: BK-YYYYMMDD-XXXX
  customerName  String
  customerPhone String
  packageId     String?
  vehicleId     String?
  driverId      String?
  createdById   String
  startDate     DateTime
  endDate       DateTime
  pickupLocation String
  dropLocation  String?
  passengers    Int           @default(1)
  amount        Decimal       @db.Decimal(10, 2)
  advancePaid   Decimal       @db.Decimal(10, 2)    @default(0)
  status        BookingStatus @default(PENDING)
  notes         String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  deletedAt     DateTime?
  package       TourPackage?  @relation(fields: [packageId], references: [id])
  vehicle       Vehicle?      @relation(fields: [vehicleId], references: [id])
  driver        Driver?       @relation(fields: [driverId], references: [id])
  createdBy     User          @relation(fields: [createdById], references: [id])
  tripSheet     TripSheet?
  invoice       Invoice?
}

enum BookingStatus {
  PENDING
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

### TripSheet
```prisma
model TripSheet {
  id              String          @id @default(uuid())
  bookingId       String          @unique
  vehicleId       String
  driverId        String
  startOdometer   Int
  endOdometer     Int?
  startTime       DateTime
  endTime         DateTime?
  fuelExpense     Decimal         @db.Decimal(10, 2) @default(0)
  tollExpense     Decimal         @db.Decimal(10, 2) @default(0)
  otherExpense    Decimal         @db.Decimal(10, 2) @default(0)
  notes           String?
  status          TripSheetStatus @default(OPEN)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  booking         Booking         @relation(fields: [bookingId], references: [id])
  vehicle         Vehicle         @relation(fields: [vehicleId], references: [id])
  driver          Driver          @relation(fields: [driverId], references: [id])
}

enum TripSheetStatus {
  OPEN
  CLOSED
}
```

### CorporateClient + Contract
```prisma
model CorporateClient {
  id          String              @id @default(uuid())
  companyName String
  gstin       String?             @unique
  address     String
  contactName String
  phone       String
  email       String
  isActive    Boolean             @default(true)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  deletedAt   DateTime?
  contracts   CorporateContract[]
  invoices    Invoice[]
}

model CorporateContract {
  id              String          @id @default(uuid())
  clientId        String
  startDate       DateTime
  endDate         DateTime
  vehicleType     VehicleType
  monthlyRate     Decimal         @db.Decimal(10, 2)
  tripLimit       Int?
  isActive        Boolean         @default(true)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  client          CorporateClient @relation(fields: [clientId], references: [id])
  invoices        Invoice[]
}
```

### Invoice
```prisma
model Invoice {
  id            String          @id @default(uuid())
  invoiceNo     String          @unique               // auto-generated: INV-YYYYMMDD-XXXX
  type          InvoiceType
  bookingId     String?         @unique
  contractId    String?
  corporateId   String?
  customerName  String
  customerGstin String?
  customerAddress String?
  subtotal      Decimal         @db.Decimal(10, 2)
  cgst          Decimal         @db.Decimal(10, 2)    @default(0)
  sgst          Decimal         @db.Decimal(10, 2)    @default(0)
  igst          Decimal         @db.Decimal(10, 2)    @default(0)
  total         Decimal         @db.Decimal(10, 2)
  status        InvoiceStatus   @default(UNPAID)
  dueDate       DateTime?
  paidAt        DateTime?
  notes         String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  booking       Booking?        @relation(fields: [bookingId], references: [id])
  contract      CorporateContract? @relation(fields: [contractId], references: [id])
  corporate     CorporateClient?   @relation(fields: [corporateId], references: [id])
}

enum InvoiceType {
  BOOKING
  CORPORATE_MONTHLY
}

enum InvoiceStatus {
  UNPAID
  PAID
  CANCELLED
}
```

### Account
```prisma
model Account {
  id        String      @id @default(uuid())
  date      DateTime
  type      AccountType
  category  String
  amount    Decimal     @db.Decimal(10, 2)
  reference String?
  notes     String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
}

enum AccountType {
  INCOME
  EXPENSE
}
```

---

## GST Calculation Rules (India)

```
Intrastate (same state):  CGST 2.5% + SGST 2.5% = 5% total
Interstate (diff state):  IGST 5%
SAC Code for transport:   996412 (local) / 996413 (long distance)

Formula:
  subtotal = base amount
  tax = if intrastate: cgst = subtotal * 0.025, sgst = subtotal * 0.025
        if interstate: igst = subtotal * 0.05
  total = subtotal + cgst + sgst + igst
```

---

## Indexes to Add (Performance)

```prisma
@@index([status])              // Booking, Vehicle, Driver
@@index([startDate, endDate])  // Booking
@@index([deletedAt])           // all soft-delete models
@@index([createdAt])           // Invoice, Account
@@index([bookingNo])           // Booking
@@index([invoiceNo])           // Invoice
```

---

## Notes (fill after MR_TRAVELS_001 P003)

- [ ] Document any schema decisions made during implementation
- [ ] Document any deviations from this template and reasons
- [ ] Add query performance notes after testing
