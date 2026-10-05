import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Run in a non-Manila zone so tests prove formatting doesn't depend on the host clock.
    env: { TZ: "America/New_York" },
  },
});
