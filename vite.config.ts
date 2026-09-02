import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// Releases are tagged on GitHub (e.g. v1.1.1) — read the latest tag reachable
// from the current commit instead of hand-maintaining a version elsewhere.
// Requires the checkout to have tag history (CI passes fetch-depth: 0).
function latestReleaseTag(): string {
  try {
    return execSync("git describe --tags --abbrev=0", { cwd: import.meta.dirname }).toString().trim();
  } catch {
    return "dev";
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  define: {
    __APP_VERSION__: JSON.stringify(latestReleaseTag()),
  },
}));
