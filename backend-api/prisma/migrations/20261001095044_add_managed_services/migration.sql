-- AlterTable
ALTER TABLE "g4d_quotes" ADD COLUMN "leadId" TEXT;
ALTER TABLE "g4d_quotes" ADD COLUMN "items" JSONB;
ALTER TABLE "g4d_quotes" ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Quote_shareToken_key" ON "g4d_quotes"("shareToken");

-- CreateTable
CREATE TABLE "g4d_managed_service_catalog_items" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "defaultRate" INTEGER NOT NULL,
    "unit" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_managed_service_catalog_items_pkey" PRIMARY KEY ("id")
);
