-- One SMS OTP per mobile number per IST calendar day (dispatch 24-Sep-2026). A brand
-- new table, not new columns on g4d_leads: a Lead row doesn't exist yet at OTP-request
-- time for a never-seen number, and this must stay fully decoupled from the existing
-- demoCategory/demoVisitKeys/demoVisitCount 3-visit cap already on Lead. Additive only.
CREATE TABLE "g4d_otp_daily_verifications" (
    "phone" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_otp_daily_verifications_pkey" PRIMARY KEY ("phone")
);
