-- Block 4b slice 12: more policy document kinds (Amendment 12 Q6). Additive only: new values on the existing enum; no row is touched. Seeded as placeholder drafts by the existing terms seed (nothing is published).
ALTER TYPE "V3TermsKind" ADD VALUE IF NOT EXISTS 'TERMS_OF_SERVICE';
ALTER TYPE "V3TermsKind" ADD VALUE IF NOT EXISTS 'REFUND_WALLET';
ALTER TYPE "V3TermsKind" ADD VALUE IF NOT EXISTS 'DOMAIN_TERMS';
ALTER TYPE "V3TermsKind" ADD VALUE IF NOT EXISTS 'ENQUIRY_CONSENT';
ALTER TYPE "V3TermsKind" ADD VALUE IF NOT EXISTS 'IDENTITY_NOTICE';
ALTER TYPE "V3TermsKind" ADD VALUE IF NOT EXISTS 'MESSAGING';
ALTER TYPE "V3TermsKind" ADD VALUE IF NOT EXISTS 'TESTIMONIAL';
ALTER TYPE "V3TermsKind" ADD VALUE IF NOT EXISTS 'DIRECTORY';
