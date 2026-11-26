-- E9c: the pay type of each telecaller. ADDITIVE ONLY: one new table that starts empty, with one foreign key to the referral partners table.
-- No existing table, column or row is changed, so the previous API image keeps working with this table present (it never reads it).
-- No pay amount is seeded: monthlySalaryMinor (paise) is entered by the owner.

-- CreateTable
CREATE TABLE "g4d_telecaller_profiles" (
    "partnerId" TEXT NOT NULL,
    "payType" TEXT NOT NULL,
    "monthlySalaryMinor" INTEGER,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_telecaller_profiles_pkey" PRIMARY KEY ("partnerId")
);

-- AddForeignKey
ALTER TABLE "g4d_telecaller_profiles" ADD CONSTRAINT "g4d_telecaller_profiles_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "g4d_referral_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The two pay types, a salary only on the salaried type, and never a zero or negative salary.
ALTER TABLE "g4d_telecaller_profiles" ADD CONSTRAINT "g4d_telecaller_profiles_paytype_check" CHECK ("payType" IN ('SALARY_PLUS_COMMISSION', 'FREELANCE_SLAB'));
ALTER TABLE "g4d_telecaller_profiles" ADD CONSTRAINT "g4d_telecaller_profiles_salary_check" CHECK ("monthlySalaryMinor" IS NULL OR ("monthlySalaryMinor" > 0 AND "payType" = 'SALARY_PLUS_COMMISSION'));

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_telecaller_profiles" ENABLE ROW LEVEL SECURITY;
