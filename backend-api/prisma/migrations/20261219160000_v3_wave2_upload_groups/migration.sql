-- Wave 2 Part G (2): a staff draft upload made before the listing existed carries an upload group token, so the create form can attach it to the listing when it is made.
-- Additive: one nullable column, one index, one check. NOT applied by this commit: the owner runs migrate-deploy on staging.

-- AlterTable
ALTER TABLE "g4d_media" ADD COLUMN "groupToken" TEXT;

-- CreateIndex
CREATE INDEX "g4d_media_uploadedById_groupToken_idx" ON "g4d_media"("uploadedById", "groupToken");

-- Check (Prisma does not model it): a token is 16 to 64 letters, digits, dashes or underscores
ALTER TABLE "g4d_media" ADD CONSTRAINT "g4d_media_group_token_check" CHECK ("groupToken" IS NULL OR "groupToken" ~ '^[A-Za-z0-9_-]{16,64}$');
