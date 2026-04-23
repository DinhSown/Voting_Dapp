-- Store OTP hashes instead of plaintext codes and track failed attempts.
ALTER TABLE "OtpSession" ADD COLUMN "otpHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OtpSession" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

UPDATE "OtpSession"
SET "otpHash" = "otpCode"
WHERE "otpHash" = '';

ALTER TABLE "OtpSession" DROP COLUMN "otpCode";
