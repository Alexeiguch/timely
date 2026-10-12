import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    fileParallelism: process.env.RUN_DB_TESTS !== "1",
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
  },
});
