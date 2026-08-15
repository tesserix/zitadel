import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./test-mocks/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    // Its ESM entry re-exports extensionless directory paths, which only a
    // bundler resolves; inlining lets Vite handle it as Next does.
    server: { deps: { inline: ["@tesserix/web"] } },
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts"],
    environment: "jsdom",
    setupFiles: ["./test-setup.ts"],
  },
});
