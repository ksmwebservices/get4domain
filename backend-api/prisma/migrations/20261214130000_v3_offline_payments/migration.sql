-- Block 4b slice 5: cash, UPI and bank transfer recorded by the business (Amendment 09 Part C1). Additive only: two new columns with defaults on g4d_payments, and one NOT NULL relaxed on g4d_payment_requests.
-- Existing rows keep their meaning: every existing payment was a UPI payment the business confirmed itself.
ALTER TABLE "g4d_payments" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'UPI';
ALTER TABLE "g4d_payments" ADD COLUMN "vendorRecorded" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "g4d_payments" ADD CONSTRAINT "g4d_payments_method_chk" CHECK ("method" IN ('UPI', 'CASH', 'BANK_TRANSFER'));
-- A payment the business writes down by hand (cash, bank transfer) needs no UPI method on file; the foreign key stays for requests that have one.
ALTER TABLE "g4d_payment_requests" ALTER COLUMN "methodId" DROP NOT NULL;
