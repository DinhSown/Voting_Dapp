-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Election" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startTime" DATETIME,
    "endTime" DATETIME,
    "onChainId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isEnded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Election" ("createdAt", "description", "endTime", "id", "isActive", "onChainId", "startTime", "title", "updatedAt") SELECT "createdAt", "description", "endTime", "id", "isActive", "onChainId", "startTime", "title", "updatedAt" FROM "Election";
DROP TABLE "Election";
ALTER TABLE "new_Election" RENAME TO "Election";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
