# Contributing to Visual Astro

Thanks for your interest in improving Visual Astro! This document covers how to
propose changes and what to expect.

## License of contributions

Visual Astro is licensed under the **GNU Affero General Public License v3.0
(AGPL-3.0)** — see [`LICENSE`](./LICENSE). By opening a pull request you agree
that your contribution is provided under the same license, so that the whole
project can stay under one consistent, copyleft license.

If you add a new dependency, please check that its license is compatible with
AGPL-3.0 (permissive licenses such as MIT, BSD, ISC, or Apache-2.0 are fine;
avoid dependencies under incompatible or non-OSI-approved/"source available"
licenses). Mention the dependency and its license in the PR description.

## Reporting bugs / requesting features

Open a GitHub issue with:

- What you expected to happen vs. what actually happened
- Steps to reproduce (for bugs)
- Browser/OS, and whether it happens in production or only in a local dev build

## Making a change

1. Fork the repository and create a branch from `main`.
2. Install dependencies: `npm install`.
3. Set up a `.env` with your own Supabase project credentials (see the
   [README](./README.md#configure-environment-variables)) — please don't use
   or commit production credentials.
4. Make your change, keeping it focused and scoped to one concern per PR.
5. Before opening a PR, run:
   ```sh
   npm run lint
   npm run test
   ```
6. Add or update tests for behavior you change (Vitest, under `*.test.ts`
   files next to the code they cover).
7. Open a pull request describing the change and the motivation behind it.
   Link any related issue.

## Database changes

Changes to the Supabase schema go in `supabase/migrations/` as a new,
timestamped SQL migration file — don't edit past migrations. Enable Row Level
Security (RLS) and add explicit policies for any new table.

## Code style

- TypeScript, React function components, and the existing `shadcn/ui` +
  Tailwind conventions used throughout `src/components`.
- Keep UI strings translatable through the existing i18n setup (`useI18n`)
  rather than hardcoding user-facing text.

## Code of conduct

Be respectful and constructive in issues, PRs, and reviews. Disagreements
about code are fine; personal attacks are not.
