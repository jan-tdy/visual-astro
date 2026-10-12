# Security Policy

Visual Astro is a continuously deployed web app, not a versioned library —
there is no "supported versions" matrix. The latest commit on `main`, as
currently deployed, is the only supported version.

## Reporting a vulnerability

Please **do not open a public GitHub issue** for a security report —
anyone can see it before it's fixed.

Instead, use GitHub's private reporting: go to the
[**Security** tab](../../security) of this repository and click
**"Report a vulnerability"** to open a private security advisory. Include:

- What the issue is and why it's a security concern (not just a bug)
- Steps to reproduce, or a proof of concept if you have one
- Impact: what data or accounts it could affect

If you can't use GitHub advisories for some reason, email
**j44soft@gmail.com** instead.

We'll acknowledge your report and let you know once a fix is out. Please
give us a reasonable amount of time to fix the issue before disclosing it
publicly.

## Scope

Visual Astro is a React single-page app backed by Supabase (Postgres, Auth,
Storage, Edge Functions). In scope:

- The web app itself (XSS, auth bypass, CSRF, etc.)
- Supabase Row Level Security policies and database functions
  (`supabase/migrations/`)
- The Edge Functions under `supabase/functions/` (`paper-ocr`, `mcp`)

Out of scope: vulnerabilities in third-party dependencies that don't have a
known exploit path through this app (report those upstream instead), and
anything requiring physical access to a user's device or already-compromised
credentials.
