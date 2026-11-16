-- Wave 3 Part C: a plan order remembers which payment gateway it was started on, and the browser checkout's session token where the gateway has one. Additive only. NOT applied by this commit: the owner runs migrate-deploy on staging.
-- 'cash' is the order an ADMIN makes for a special cash case (Part E): it has no gateway order and is settled only by an admin confirming the cash.
-- Every order that exists today was started on Razorpay, which is the column default, so no existing row changes meaning.

ALTER TABLE "g4d_plan_orders" ADD COLUMN "gateway" TEXT NOT NULL DEFAULT 'razorpay';
ALTER TABLE "g4d_plan_orders" ADD COLUMN "gatewayClientToken" TEXT;

ALTER TABLE "g4d_plan_orders" ADD CONSTRAINT "g4d_plan_orders_gateway_check" CHECK ("gateway" IN ('razorpay', 'cashfree', 'cash'));
