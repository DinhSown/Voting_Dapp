-- Remove legacy phone authentication data.
DROP TABLE IF EXISTS "PhoneOtpSession";

DROP INDEX IF EXISTS "User_phone_key";

ALTER TABLE "User" DROP COLUMN "phone";
