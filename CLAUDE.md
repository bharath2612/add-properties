# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Internal analytics and admin dashboard for the Prop8t platform. Built with Vite + React 18 + TypeScript. Shares the same Supabase backend as the main prop8t app.

## Git Workflow

- **Work directly on `main`.** Push to `origin/main`.
- No pre-commit hooks — ensure `npm run build` passes before pushing.
- After every push, update `CHANGELOG.md` at the repo root with a summary.

## Development Commands

```bash
npm run dev              # Start Vite dev server
npm run build            # Production build (tsc + vite build)
npm run dev:functions    # Run Cloudflare Pages functions locally
```

## Architecture

### Directory Structure (src/)

```
components/
  ├── analytics/         # Analytics pages (AnalyticsOverview, PropertyAnalytics, UserAnalytics)
  ├── dashboard/         # Dashboard views
  ├── developer/         # Developer management
  ├── property-entry/    # Property entry forms
  ├── lasco/             # Lasco integration
  └── common/            # Shared components (ErrorBoundary, etc.)
contexts/                # React contexts
lib/                     # Supabase client
types/                   # TypeScript definitions
utils/                   # Utility functions
```

### Key Integrations

- **Backend**: Supabase (shared with prop8t app)
- **Data**: Reads from `visitor_fingerprints`, `user_sessions`, `user_activity_events` tables
- **Deployment**: Cloudflare Pages with server-side functions

## Related Repos

- **prop8t/** (sibling repo) — Main user-facing platform that generates the analytics data
- Backend AI repos are **read-only** — do not edit
