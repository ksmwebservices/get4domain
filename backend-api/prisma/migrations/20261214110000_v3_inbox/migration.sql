-- Block 4b slice 2: the enquiry inbox. Additive only: one new table, no existing object is touched.
CREATE TABLE "g4d_inbox_messages" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "messageIdHdr" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "spamScore" DOUBLE PRECISION,
    "spamVerdict" TEXT NOT NULL DEFAULT 'CLEAN',
    "state" TEXT NOT NULL DEFAULT 'NEW',
    "forwardStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "forwardedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_inbox_messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "g4d_inbox_messages_vendorId_messageIdHdr_key" ON "g4d_inbox_messages"("vendorId", "messageIdHdr");
CREATE INDEX "g4d_inbox_messages_vendorId_createdAt_idx" ON "g4d_inbox_messages"("vendorId", "createdAt");
CREATE INDEX "g4d_inbox_messages_vendorId_state_createdAt_idx" ON "g4d_inbox_messages"("vendorId", "state", "createdAt");
ALTER TABLE "g4d_inbox_messages" ADD CONSTRAINT "g4d_inbox_messages_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_inbox_messages" ADD CONSTRAINT "g4d_inbox_messages_state_chk" CHECK ("state" IN ('NEW', 'READ', 'ARCHIVED', 'HELD'));
ALTER TABLE "g4d_inbox_messages" ADD CONSTRAINT "g4d_inbox_messages_spam_chk" CHECK ("spamVerdict" IN ('CLEAN', 'SPAM'));
ALTER TABLE "g4d_inbox_messages" ADD CONSTRAINT "g4d_inbox_messages_forward_chk" CHECK ("forwardStatus" IN ('PENDING', 'FORWARDED', 'SKIPPED_FLAG_OFF', 'SKIPPED_SPAM', 'SKIPPED_PLAN_ENDED', 'FAILED'));

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_inbox_messages" ENABLE ROW LEVEL SECURITY;
