-- B3.3 included services. Additive: one new table. Nothing existing is changed or dropped.
-- One row = "this plan, on this billing term, includes N of this service group". NO row = NOT SET (nothing is included): the owner has not set any quantity, so none is written.
CREATE TABLE "g4d_plan_service_allowances" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "groupKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_plan_service_allowances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "g4d_plan_service_allowances_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "g4d_plan_service_allowances_term_valid" CHECK ("termMonths" IN (3, 6, 12))
);

CREATE UNIQUE INDEX "g4d_plan_service_allowances_planId_termMonths_groupKey_key" ON "g4d_plan_service_allowances"("planId", "termMonths", "groupKey");

ALTER TABLE "g4d_plan_service_allowances" ADD CONSTRAINT "g4d_plan_service_allowances_planId_fkey" FOREIGN KEY ("planId") REFERENCES "g4d_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- like every platform table: row level security ON and no policy, so only the server role reads or writes it
ALTER TABLE "g4d_plan_service_allowances" ENABLE ROW LEVEL SECURITY;
