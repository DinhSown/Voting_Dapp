import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    provider: "sqlite",
    url: process.env["DATABASE_URL"] ?? "file:./dev.db",
  },
});
