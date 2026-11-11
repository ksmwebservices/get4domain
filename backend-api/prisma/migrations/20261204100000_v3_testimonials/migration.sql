-- Slice B4 (Website manager, amendment 08): the testimonials of the live site, for staff. Additive only: one new table. No rating column exists.
-- CreateTable
CREATE TABLE "g4d_testimonials" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "date" TEXT,
    "version" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_testimonials_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "g4d_testimonials_vendorId_position_key" ON "g4d_testimonials"("vendorId", "position");
CREATE INDEX "g4d_testimonials_vendorId_idx" ON "g4d_testimonials"("vendorId");
-- AddForeignKey
ALTER TABLE "g4d_testimonials" ADD CONSTRAINT "g4d_testimonials_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_testimonials" ENABLE ROW LEVEL SECURITY;
