-- B2.1 registration creates the site. Additive: three nullable columns on "Vendor". Nothing existing is changed or dropped.
-- A signup whose trial site could not be made records FAILED + a short code here (never an error text) so the vendor app can offer "Create my site".
ALTER TABLE "Vendor" ADD COLUMN "siteProvisionStatus" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "siteProvisionCode" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "siteProvisionFailedAt" TIMESTAMP(3);
