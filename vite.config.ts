import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// Releases are tagged on GitHub as v1.1.1 etc — read the nearest such tag
// reachable from the current commit instead of hand-maintaining a version
// elsewhere. Requires the checkout to have tag history (CI passes
// fetch-depth: 0). --match restricts this to real release tags: the repo
// also carries a bunch of legacy/ad-hoc tags from before releases were
// standardized (e.g. "august24-01", "first-github-release-of-visual-astro")
// which `git describe` would otherwise happily pick as the "nearest" tag,
// showing a meaningless or overly long string in the UI.
function latestReleaseTag(): string {
  try {
    return execSync("git describe --tags --abbrev=0 --match 'v[0-9]*'", { cwd: import.meta.dirname })
      .toString()
      .trim();
  } catch {
    // No reachable v* tag (e.g. a shallow clone with no tag history). Fall
    // back to a short commit hash so the badge still identifies the build
    // instead of showing the same uninformative "dev" for every commit.
    try {
      const sha = execSync("git rev-parse --short HEAD", { cwd: import.meta.dirname }).toString().trim();
      return `dev-${sha}`;
    } catch {
      return "dev";
    }
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
