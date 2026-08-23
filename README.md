# Visual Astro — Visual Observation Log

[![CI](https://github.com/jan-tdy/visual-astro/actions/workflows/ci.yml/badge.svg)](https://github.com/jan-tdy/visual-astro/actions/workflows/ci.yml)

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
- **Plans** — everyone gets the Free plan (all features, 0.4 GB storage, 4 AI scans/month)
  for free; Enterprise offers negotiable limits on request, see Settings → Plan & billing.
- **MCP server** — the app exposes an [MCP](https://modelcontextprotocol.io/) tool server
  (`supabase/functions/mcp`) so AI assistants can read/write sessions, stars, CCD targets,
  and more on the observer's behalf.

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) + [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) (Postgres, Auth, Storage, Edge Functions)
- [astronomy-engine](https://github.com/cosinekitty/astronomy) for astronomical calculations
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

This is a [Lovable](https://lovable.dev/) project, and its Supabase
integration manages `.env` (project URL, project ID, and publishable/anon
key) automatically — you generally don't need to touch it by hand. `.env` is
committed with these values for that reason: it's the Supabase publishable
(anon) key, which isn't a secret and is meant to be used client-side.

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
  functions/   # Edge Functions (mcp, paper-ocr)
  migrations/  # database schema migrations
```

## Backend (Supabase)

The `supabase/` directory contains the database migrations and Edge Functions backing
the app: authentication-protected data access, paper OCR, and the MCP tool server. See
`supabase/config.toml` and `supabase/functions/` for details.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) for how to
get set up, coding conventions, and the PR process.

## License

Licensed under the [GNU Affero General Public License v3.0](./LICENSE)
(AGPL-3.0). This means you're free to use, study, modify, and redistribute
this code (including running your own instance), but any modified version
that you run as a network service must also make its source available to its
users under the same license.
