import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias: { "server-only": fileURLToPath(new URL("./test-mocks/server-only.ts", import.meta.url)) } },
  test: {
    include: ["tests/consumer-email.integration.test.ts"],
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
