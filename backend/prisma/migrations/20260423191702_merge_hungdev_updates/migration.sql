-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OtpSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_OtpSession" ("attempts", "createdAt", "email", "expiresAt", "id", "otpHash") SELECT "attempts", "createdAt", "email", "expiresAt", "id", "otpHash" FROM "OtpSession";
DROP TABLE "OtpSession";
ALTER TABLE "new_OtpSession" RENAME TO "OtpSession";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
