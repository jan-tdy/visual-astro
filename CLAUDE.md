# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install          # install dependencies
npm run dev           # start the Vite dev server (port 8080)
npm run build          # production build
npm run build:dev       # development-mode build
npm run preview          # preview a production build locally
npm run lint               # ESLint over the whole repo (blocking in CI, see below)
npm test                     # run all tests once (Vitest)
npm run test:watch            # run tests in watch mode
npx tsc --noEmit                # type check only (also run separately in CI)
```

Run a single test file or test name with Vitest directly, e.g.:
```sh
npx vitest run src/lib/pozor.test.ts
npx vitest run -t "some test name"
```

CI (`.github/workflows/ci.yml`) runs, in order: type check, lint, test, build — all of
which must pass. Before opening a PR, run `npm run lint` and `npm test` locally
(per `CONTRIBUTING.md`).

### Lint backlog

`eslint.config.js` downgrades `@typescript-eslint/no-explicit-any` and several
React Compiler hook-safety rules (`react-hooks/set-state-in-effect`,
`static-components`, `preserve-manual-memoization`, `refs`, `purity`,
`immutability`) to `warn` rather than `error`, because there's a real
pre-existing backlog of both that predates lint actually blocking CI. Don't
add *new* violations of these; existing ones don't need to be fixed as a
drive-by. `@typescript-eslint/no-unused-vars` is enabled with an `^_` ignore
pattern — prefix an intentionally-unused destructured field or arg with `_`
(e.g. `{ id: _id, ...rest }`) rather than disabling the rule.

## Issue and PR templates

When filing a GitHub issue, use the matching form under
`.github/ISSUE_TEMPLATE/` (`bug_report.yml` or `feature_request.yml`) rather
than a freeform issue — fill in every required field, including the
`[Module]` prefix in the title (e.g. `[Sessions]`, `[Pozor]`) using one of
the module options the template lists.

When opening a pull request, fill out `.github/pull_request_template.md`
in full: a `Description`, the `Related Issues` links (`Fixes #123` to close
an issue, `Related to #123` to reference one without closing it), the
`Type of Change` checkbox, and the `Checklist`. Only keep the trailing
`Note`/`FAQ` section for large, multi-issue PRs — delete it otherwise, as
the template itself says.

## Architecture

Visual Astro is a Vite + React + TypeScript SPA for logging visual variable-star
observations, backed by Supabase (Postgres, Auth, Storage, Edge Functions). See
`README.md` for the feature list and tech stack, and `CONTRIBUTING.md` for
contribution/PR conventions and migration rules.

### App shell and routing

`src/App.tsx` nests the app in `QueryClientProvider` → `ThemeProvider` →
`I18nProvider` → `AuthProvider` → `SubscriptionProvider`, then a flat
`react-router-dom` route table. Every route except `/auth`, `/info`, and
`/julian-date-converter` is wrapped in `ProtectedRoute` (auth required). Each
top-level feature is one page under `src/pages/` (Sessions, Catalog, Prom,
Pozor, Graphs, Compare, Tools, Settings) — there's no nested/lazy route tree,
just direct imports.

### Internationalization (`src/hooks/useI18n.tsx`)

Two layers, and both matter when adding user-facing text:
- A hardcoded `dict` object with full `sk` and `en` translations, committed in
  this file — currently the *only* two languages with real content, because
  Tolgee's paid tier (needed for more project languages) isn't set up yet.
  **Add every new key to both the `sk` and `en` blocks of `dict`.**
- An optional runtime overlay fetched from Tolgee Content Delivery (a public
  CDN, no API key) for the other listed languages (cs, de, es, fr, it, pl).
  This is deliberately *not* registered as Tolgee `staticData` — see the
  comment above `let builder = Tolgee()` for why (stale-cache trap).

### MCP tool server (`src/lib/mcp/` → `supabase/functions/mcp/index.ts`)

The app exposes an MCP server so AI assistants can read/write the observer's
data. Individual tools live as separate files under `src/lib/mcp/tools/`
(one file per tool, e.g. `create-session.ts`, `list-stars.ts`) using
`defineTool` from `@lovable.dev/mcp-js`, composed in `src/lib/mcp/index.ts`.

**`supabase/functions/mcp/index.ts` is a generated build artifact**, bundled
from `src/lib/mcp/**` by the `mcpPlugin()` Vite plugin (`vite.config.ts`) on
every `npm run dev`/`npm run build`. Never hand-edit it — edit the source
under `src/lib/mcp/` instead and let the plugin regenerate the bundle (it's
excluded from `eslint.config.js` for this reason, and committing it back in
sync with a source change is expected/correct).

### Astronomy and export logic

`src/lib/pozor.ts` and `src/lib/astro.ts` hold the astronomical calculations
(built on `astronomy-engine`) shared by the Pozor night-planning views and the
MCP tools. `src/lib/exporters/` builds the VSNET/AAVSO export text formats;
`src/lib/aavso.ts` fetches AAVSO light-curve data (used by the Compare page).
Paper OCR (scanning handwritten sheets) is a separate Supabase Edge Function
at `supabase/functions/paper-ocr/`, hand-written (not generated).

### Supabase integration

`src/integrations/supabase/` holds the generated client and DB types.
`supabase/migrations/` contains timestamped, append-only SQL migrations —
per `CONTRIBUTING.md`, never edit a past migration; add a new one, and add
explicit RLS policies for any new table. This is also a
[Lovable](https://lovable.dev/) project: `.env` is committed intentionally
(publishable/anon key only, not a secret) and is managed by Lovable's
Supabase integration.
