-- Amendment 13 Part B (B7): the claim code can go by email. One value is added to the existing enum; nothing is renamed, removed or re-used.
ALTER TYPE "V3OtpChannel" ADD VALUE IF NOT EXISTS 'EMAIL';
