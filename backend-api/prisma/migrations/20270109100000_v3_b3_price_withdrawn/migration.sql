-- B3.0 withdrawing an approved plan price. Additive: one new value of an existing enum. Nothing existing is changed or dropped.
-- A withdrawn price keeps its row, amount and start date; it only stops counting as in force. The reason is in the audit log.
ALTER TYPE "V3PriceStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';
