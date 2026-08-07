# Visual Astro — Visual Observation Log

A modern, web-based replacement for the classic `Reducciones.ods` spreadsheet used by
visual variable-star observers. Visual Astro helps you log observing sessions, estimate
star magnitudes with the Nijland-Blazhko method, and export your results straight to
[VSNET](https://vsnet.kusastro.kyoto-u.ac.jp/) and [AAVSO](https://www.aavso.org/).

## Features

- **Sessions** — record observing sessions and individual magnitude estimates.
- **Catalog** — manage your personal catalog of variable stars and comparison sequences.
- **Pozor** (night planning) — altitude charts, night charts, minima predictions, a CCD
  target catalog, location manager, and an observation journal for planning a night out.
- **Prom** — a spreadsheet-style reductions table in the spirit of the original
  `Reducciones.ods`.
- **Graphs** — visualize magnitude history and trends.
- **Tools** — utilities such as a Julian Date converter.
- **Exports** — generate VSNET/AAVSO-ready exports, PDF paper templates, and JSON/XLSX
  data dumps.
- **Paper OCR** — scan and import handwritten observation sheets (Supabase Edge Function).
- **Multi-language UI** — powered by [Tolgee](https://tolgee.io/).
- **Subscriptions** — optional paid plan via Stripe checkout/portal.
- **MCP server** — the app exposes an [MCP](https://modelcontextprotocol.io/) tool server
  (`supabase/functions/mcp`) so AI assistants can read/write sessions, stars, CCD targets,
  and more on the observer's behalf.

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) + [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) (Postgres, Auth, Storage, Edge Functions)
- [astronomy-engine](https://github.com/cosinekitty/astronomy) for astronomical calculations
- [Stripe](https://stripe.com/) for subscription billing
- [Tolgee](https://tolgee.io/) for internationalization
- [TanStack Query](https://tanstack.com/query) for data fetching/caching
- [Vitest](https://vitest.dev/) + Testing Library for tests

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (or [Bun](https://bun.sh/), a `bun.lockb` is included)
- A [Supabase](https://supabase.com/) project (for auth, database, and edge functions)

### Install

```sh
npm install
```

### Configure environment variables

Create a `.env` file in the project root with your Supabase project credentials:

```sh
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PROJECT_ID=your-supabase-project-id
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

For local Stripe checkout testing, `.env.development` provides a test publishable key
via `VITE_PAYMENTS_CLIENT_TOKEN`.

### Run the dev server

```sh
npm run dev
```

### Other scripts

```sh
npm run build       # production build
npm run build:dev    # development-mode build
npm run preview      # preview a production build locally
npm run lint          # run ESLint
npm run test           # run tests once (Vitest)
npm run test:watch     # run tests in watch mode
```

## Project structure

```
src/
  components/
    app/       # app shell (header, search, error boundary, protected routes)
    pozor/     # night-planning widgets (charts, journal, catalogs, locations)
    tools/     # standalone utilities (e.g. JD converter)
    ui/        # shadcn/ui primitives
  hooks/       # auth, subscription, theme, i18n providers/hooks
  integrations/
    supabase/  # Supabase client and generated types
    lovable/   # Lovable platform integration
  lib/         # astronomy, exporters, PDF/OCR helpers, MCP tool implementations
  pages/       # route-level pages (Sessions, Catalog, Pozor, Graphs, Tools, ...)
supabase/
  functions/   # Edge Functions (mcp, paper-ocr, checkout, billing portal, webhooks)
  migrations/  # database schema migrations
```

## Backend (Supabase)

The `supabase/` directory contains the database migrations and Edge Functions backing
the app: authentication-protected data access, Stripe checkout/portal/webhook handling,
paper OCR, and the MCP tool server. See `supabase/config.toml` and `supabase/functions/`
for details.

## License

No license has been specified for this project.
