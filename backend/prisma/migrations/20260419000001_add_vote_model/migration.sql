-- CreateTable
CREATE TABLE "Vote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "candidateName" TEXT NOT NULL DEFAULT '',
    "categoryTitle" TEXT NOT NULL DEFAULT '',
    "txHash" TEXT,
    "votedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Vote_userId_categoryId_key" ON "Vote"("userId", "categoryId");
