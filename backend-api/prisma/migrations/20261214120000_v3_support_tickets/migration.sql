-- Block 4b slice 4: support tickets. Additive only: two new tables, no existing object is touched (the legacy support ticket table is not used).
CREATE TABLE "g4d_v3_tickets" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "requesterType" TEXT NOT NULL,
    "requesterName" TEXT,
    "requesterEmail" TEXT,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedToStaffId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_v3_tickets_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_v3_ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "attachmentPictureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_v3_ticket_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "g4d_v3_tickets_vendorId_createdAt_idx" ON "g4d_v3_tickets"("vendorId", "createdAt");
CREATE INDEX "g4d_v3_tickets_status_lastMessageAt_idx" ON "g4d_v3_tickets"("status", "lastMessageAt");
CREATE INDEX "g4d_v3_tickets_requesterEmail_createdAt_idx" ON "g4d_v3_tickets"("requesterEmail", "createdAt");
CREATE INDEX "g4d_v3_ticket_messages_ticketId_createdAt_idx" ON "g4d_v3_ticket_messages"("ticketId", "createdAt");
ALTER TABLE "g4d_v3_tickets" ADD CONSTRAINT "g4d_v3_tickets_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_v3_ticket_messages" ADD CONSTRAINT "g4d_v3_ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "g4d_v3_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_v3_tickets" ADD CONSTRAINT "g4d_v3_tickets_status_chk" CHECK ("status" IN ('OPEN', 'IN_PROGRESS', 'WAITING_VENDOR', 'RESOLVED'));
ALTER TABLE "g4d_v3_tickets" ADD CONSTRAINT "g4d_v3_tickets_requester_chk" CHECK ("requesterType" IN ('VENDOR', 'CUSTOMER'));
ALTER TABLE "g4d_v3_tickets" ADD CONSTRAINT "g4d_v3_tickets_category_chk" CHECK ("category" IN ('GENERAL', 'BILLING', 'SITE', 'DOMAIN', 'ORDER', 'OTHER'));
-- A vendor ticket names its vendor; a customer ticket names an email address to answer.
ALTER TABLE "g4d_v3_tickets" ADD CONSTRAINT "g4d_v3_tickets_who_chk" CHECK (("requesterType" = 'VENDOR' AND "vendorId" IS NOT NULL) OR ("requesterType" = 'CUSTOMER' AND "requesterEmail" IS NOT NULL));
ALTER TABLE "g4d_v3_ticket_messages" ADD CONSTRAINT "g4d_v3_ticket_messages_author_chk" CHECK ("authorType" IN ('VENDOR', 'STAFF', 'CUSTOMER'));

-- Messages are append-only: they can never be changed, and can be deleted only together with their ticket (cascade from a removed vendor or test tenant).
CREATE OR REPLACE FUNCTION g4d_v3_ticket_messages_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'g4d_v3_ticket_messages rows cannot be changed';
  END IF;
  IF EXISTS (SELECT 1 FROM "g4d_v3_tickets" WHERE "id" = OLD."ticketId") THEN
    RAISE EXCEPTION 'g4d_v3_ticket_messages rows cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "g4d_v3_ticket_messages_immutable_trg" BEFORE UPDATE OR DELETE ON "g4d_v3_ticket_messages" FOR EACH ROW EXECUTE FUNCTION g4d_v3_ticket_messages_immutable();

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_v3_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_v3_ticket_messages" ENABLE ROW LEVEL SECURITY;
