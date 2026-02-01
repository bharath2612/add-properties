# Production Error Monitoring + AI Auto-Fix System (LASCO)

## Overview

Add error monitoring with **AI-powered autonomous debugging and fixing** to the **existing admin dashboard** (admin.prop8t.ai). Replaces Sonarly with a custom solution that captures rich event timelines, investigates errors, and **automatically fixes bugs by pushing to a `lasco` branch**.

**Location:** Integrated into `/Users/bharathchippa/Downloads/Propzing/admin-dashboard`

**Tech Stack:**
- Admin Dashboard: Vite + React + TypeScript
- Database: Supabase (PostgreSQL)
- AI: LangChain (supports model switching: Claude Sonnet, GPT-4, etc.)
- Worker: Hetzner VPS + Node.js + PM2
- Notifications: Slack only
- Git: GitHub API for PR creation

**Key Differentiator:** AI doesn't just investigate - it **writes fixes, generates tests, and commits to the `lasco` branch**.

---

## Git Workflow

```
main (production)
  ↑
staging (integration) ← PRs from human devs + lasco branch
  ↑
lasco (AI fixes only) ← LASCO commits here
```

**Rules:**
1. LASCO commits all fixes to `lasco` branch only
2. `lasco` merges into `staging` (NOT directly to main)
3. `staging` receives PRs from both human developers and the lasco branch
4. After each merge to staging, `lasco` branch force-resets to latest staging
5. Typical cadence: one PR/day from lasco → staging
6. Human reviews lasco branch before creating PR to staging

**Branch Conflict Handling:**
- When syncing from staging, force-reset lasco to staging HEAD
- Any pending/uncommitted fixes are re-generated against fresh code

---

## Event Timeline Format (Sonarly-Style)

The system captures rich event timelines:

```json
{
  "format": "FULL_EVENT_TIMELINE_V1",
  "session": {
    "session_id": "3688260917072854678",
    "project_id": 1,
    "user_id": null,
    "visitor_fingerprint_id": "abc123"
  },
  "environment": {
    "os": "Windows",
    "browser": "Chrome",
    "runtime": null,
    "env": "production"
  },
  "timeline": [
    {
      "ts": "2026-01-31T05:31:24.325Z",
      "layer": "user",
      "event": "navigation",
      "message": "User navigated to /",
      "context": { "page_url": "/" }
    },
    {
      "ts": "2026-01-31T05:31:24.325Z",
      "layer": "frontend",
      "event": "error",
      "severity": "ERROR",
      "message": "TypeError: Failed to fetch",
      "bug": {
        "is_error": true,
        "bug_group": "console_error@stack:...",
        "error_type": "console_error",
        "severity": "blocking"
      }
    },
    {
      "ts": "2026-01-31T05:33:27.482Z",
      "layer": "network",
      "event": "request",
      "message": "GET /rest/v1/partner_developers",
      "network": {
        "request_id": "net:f739495db2fd",
        "method": "GET",
        "url": "https://api.prop8t.ai/rest/v1/..."
      }
    },
    {
      "ts": "2026-01-31T05:33:27.888Z",
      "layer": "network",
      "event": "response",
      "network": {
        "request_id": "net:f739495db2fd",
        "status_code": 200,
        "duration_ms": 406,
        "transferred_body_size": 29
      }
    }
  ]
}
```

**Bug Severity Categories:**
- `blocking` - Critical errors that break functionality
- `annoying` - Non-critical but affects UX
- `warning` - Potential issues
- `info` - Informational logging

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PROP8T APP                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐   │
│  │ Browser (SDK)│  │ API Routes   │  │ Supabase Edge Functions (12) │   │
│  │ @sentry/next │  │ @sentry/next │  │ Custom error-tracker.ts      │   │
│  │ + Timeline   │  │              │  │                              │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┬───────────────┘   │
└─────────┼─────────────────┼──────────────────────────┼──────────────────┘
          │                 │                          │
          └────────────────┬┴──────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   SENTRY    │ (Free tier: 5K errors/mo)
                    │  Dashboard  │
                    └──────┬──────┘
                           │ Webhook
                    ┌──────▼──────────────────────────────────────────────┐
                    │         HETZNER VPS (lasco-api.prop8t.ai)           │
                    │  ┌────────────────────────────────────────────────┐  │
                    │  │  Node.js + PM2                                 │  │
                    │  │  ┌─────────────┐    ┌─────────────────────┐    │  │
                    │  │  │  Webhook    │    │  Auto-Fix Worker    │    │  │
                    │  │  │  Receiver   │───▶│  (Queue + Lock)     │    │  │
                    │  │  └─────────────┘    └──────────┬──────────┘    │  │
                    │  │         │                      │               │  │
                    │  │         ▼                      ▼               │  │
                    │  │  ┌─────────────┐    ┌─────────────────────┐    │  │
                    │  │  │  Supabase   │    │  LangChain AI       │    │  │
                    │  │  │  - errors   │◄───│  - Claude/GPT-4     │    │  │
                    │  │  │  - groups   │    │  - Fallback chain   │    │  │
                    │  │  │  - fixes    │    │  - Context builder  │    │  │
                    │  │  │  - timelines│    └──────────┬──────────┘    │  │
                    │  │  └─────────────┘               │               │  │
                    │  │         │                      ▼               │  │
                    │  │         │           ┌─────────────────────┐    │  │
                    │  │         │           │  GitHub API         │    │  │
                    │  │         │           │  - Push to lasco    │    │  │
                    │  │         │           │  - No auto-PR       │    │  │
                    │  │         │           └─────────────────────┘    │  │
                    │  │         ▼                                      │  │
                    │  │  ┌─────────────┐                               │  │
                    │  │  │ Slack       │                               │  │
                    │  │  │ (View only) │                               │  │
                    │  │  └─────────────┘                               │  │
                    │  └────────────────────────────────────────────────┘  │
                    └──────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────▼────────────────────────────┐
                    │              ADMIN DASHBOARD (admin.prop8t.ai)       │
                    │  Sidebar Section: LASCO                              │
                    │  - /lasco/errors         (Error list)                │
                    │  - /lasco/errors/:id     (Error detail + timeline)   │
                    │  - /lasco/investigations (AI analysis results)       │
                    │  - /lasco/fixes          (Auto-fix status)           │
                    │  - /lasco/settings       (AI config, kill switch)    │
                    └──────────────────────────────────────────────────────┘
```

---

## Auto-Fix Trigger Rules

| Severity | Trigger Rule |
|----------|--------------|
| `blocking` | Immediate auto-fix on first occurrence |
| `annoying` | Auto-fix after 10+ occurrences within 1 hour |
| `warning` | No auto-fix (investigation only) |
| `info` | No auto-fix (logged only) |

---

## Auto-Fix Pipeline

```
Error arrives → Queue (sequential, locked) → Build Timeline → AI Investigate
                                                                    │
                     ┌──────────────────────────────────────────────┘
                     │
                     ▼
            Can AI fix it?
                     │
          ┌─────────┴──────────┐
          │ YES                │ NO
          ▼                    ▼
    AI Generate Fix      Escalate (special
    + Generate Test       Slack alert)
          │
          ▼
    Commit to lasco branch
    (fix + test in same commit)
          │
          ▼
    GitHub Actions runs tests
          │
    ┌─────┴─────┐
    │ PASS      │ FAIL
    ▼           ▼
  Done!      Mark as
             "needs review"
          │
          ▼
    Slack notification
    (thread reply if "Know More")
```

**Key Pipeline Decisions:**
- **Race condition handling:** Queue + database lock. Process fixes sequentially.
- **PR creation:** No auto-PR. Commits go to `lasco` branch. Human creates PR to staging.
- **Test requirement:** AI MUST generate a test. Fix + test committed together.
- **Test execution:** GitHub Actions runs tests (not VPS).
- **Unfixable errors:** Escalate with special Slack alert for human attention.

---

## AI Configuration

### LangChain Integration

Use LangChain for model flexibility. Supports switching between providers without code changes.

```typescript
// lib/lasco/ai/provider.ts
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";

interface AIProviderConfig {
  provider: 'anthropic' | 'openai';
  model: string;
  fallback?: AIProviderConfig;
}

const defaultConfig: AIProviderConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  fallback: {
    provider: 'openai',
    model: 'gpt-4-turbo',
  }
};

// Fallback chain: try primary, if fails try fallback
async function runWithFallback(prompt: string, config: AIProviderConfig) {
  try {
    return await runAI(prompt, config);
  } catch (error) {
    if (config.fallback) {
      console.log(`Primary failed, trying fallback: ${config.fallback.provider}`);
      return await runAI(prompt, config.fallback);
    }
    throw error;
  }
}
```

### Context Building

AI decides what files are relevant (2-step process):

1. **Step 1:** AI receives error + stack trace, returns list of files it needs
2. **Step 2:** Fetch those files from GitHub, send to AI with full context

**GitHub API Rate Limits:**
- If rate limited, queue the investigation for later
- Accept delay during high-volume periods

---

## Database Schema

### Core Tables

```sql
-- 1. error_events - Raw errors from Sentry webhook
CREATE TABLE error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sentry_event_id text UNIQUE NOT NULL,
  sentry_issue_id text,
  error_fingerprint text NOT NULL,  -- Use Sentry's fingerprint
  error_group_id uuid REFERENCES error_groups(id),
  error_type text NOT NULL,
  error_message text NOT NULL,
  stack_trace text,
  parsed_stack jsonb,
  source text NOT NULL CHECK (source IN ('client', 'server', 'edge_function', 'api')),
  environment text DEFAULT 'production',
  -- Link to prop8t tracking
  visitor_fingerprint_id uuid,
  session_id uuid,
  user_id uuid,
  -- Request context
  url text,
  user_agent text,
  device_type text,
  browser text,
  os text,
  -- Status
  investigation_status text DEFAULT 'pending',
  occurred_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. error_groups - Deduplicated groups (using Sentry's fingerprint)
CREATE TABLE error_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text UNIQUE NOT NULL,  -- Sentry's fingerprint
  error_type text NOT NULL,
  error_message text NOT NULL,
  first_file text,
  first_line integer,
  occurrence_count integer DEFAULT 1,
  affected_users_count integer DEFAULT 0,
  status text DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'investigating', 'resolved', 'ignored')),
  severity text DEFAULT 'annoying' CHECK (severity IN ('blocking', 'annoying', 'warning', 'info')),
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
);

-- 3. ai_investigations - AI analysis results
CREATE TABLE ai_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_event_id uuid REFERENCES error_events(id),
  error_group_id uuid REFERENCES error_groups(id),
  status text DEFAULT 'pending',
  root_cause_summary text,
  detailed_analysis text,
  affected_component text,
  error_category text,
  likely_causes jsonb,
  suggested_fixes jsonb,
  related_code_files jsonb,
  can_auto_fix boolean DEFAULT false,
  model_used text,
  prompt_tokens integer,
  completion_tokens integer,
  total_cost_usd numeric(10,6),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 4. auto_fixes - Track AI-generated fixes
CREATE TABLE auto_fixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_event_id uuid REFERENCES error_events(id),
  ai_investigation_id uuid REFERENCES ai_investigations(id),
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'generating', 'committed', 'tests_running',
    'tests_passed', 'tests_failed', 'needs_review', 'failed'
  )),
  branch_name text DEFAULT 'lasco',
  commit_sha text,
  files_changed jsonb,     -- [{path, old_code, new_code, explanation}]
  test_file_path text,     -- Path to generated test
  test_code text,          -- Generated test code
  commit_message text,
  model_used text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- 5. event_timelines - Sonarly-style rich event capture
-- Only stored for error/annoying sessions, deleted after 30 days
CREATE TABLE event_timelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_event_id uuid REFERENCES error_events(id),
  session_id text NOT NULL,
  environment jsonb NOT NULL,  -- {os, browser, runtime, env}
  timeline jsonb NOT NULL,     -- Array of events
  created_at timestamptz DEFAULT now()
);

-- 6. fix_queue - Sequential processing queue with lock
CREATE TABLE fix_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_event_id uuid REFERENCES error_events(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  locked_at timestamptz,
  locked_by text,  -- Worker ID
  attempts integer DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now()
);

-- 7. lasco_config - System configuration
CREATE TABLE lasco_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Insert default config
INSERT INTO lasco_config (key, value) VALUES
  ('autofix_enabled', 'true'),  -- Kill switch
  ('ai_provider', '{"primary": "anthropic", "model": "claude-sonnet-4-20250514", "fallback": {"provider": "openai", "model": "gpt-4-turbo"}}'),
  ('annoying_threshold', '{"count": 10, "window_minutes": 60}');

-- 8. notification_log - Sent Slack notifications
CREATE TABLE notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_group_id uuid REFERENCES error_groups(id),
  notification_type text,  -- 'new_error', 'fix_committed', 'escalation', 'know_more'
  slack_ts text,           -- Slack message timestamp (for thread replies)
  status text DEFAULT 'sent',
  created_at timestamptz DEFAULT now()
);

-- Auto-delete timelines after 30 days
CREATE OR REPLACE FUNCTION delete_old_timelines()
RETURNS void AS $$
BEGIN
  DELETE FROM event_timelines WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron (if available) or external cron
-- SELECT cron.schedule('delete-old-timelines', '0 3 * * *', 'SELECT delete_old_timelines()');
```

---

## File Structure

### Admin Dashboard (admin-dashboard/)

```
admin-dashboard/
├── src/
│   ├── pages/
│   │   └── lasco/                    # NEW - LASCO section
│   │       ├── ErrorsPage.tsx        # Error list + filters
│   │       ├── ErrorDetailPage.tsx   # Error detail + timeline
│   │       ├── InvestigationsPage.tsx # AI investigations
│   │       ├── FixesPage.tsx         # Auto-fix tracking
│   │       └── SettingsPage.tsx      # AI config, kill switch
│   │
│   ├── components/
│   │   └── lasco/                    # NEW - LASCO components
│   │       ├── ErrorList.tsx
│   │       ├── ErrorCard.tsx
│   │       ├── StackTrace.tsx
│   │       ├── EventTimeline.tsx     # Full timeline, layer filters
│   │       ├── InvestigationCard.tsx
│   │       ├── DiffViewer.tsx        # Inline unified diff
│   │       ├── TestCodeViewer.tsx
│   │       └── KillSwitch.tsx
│   │
│   ├── hooks/
│   │   └── useLasco.ts               # NEW - LASCO data hooks
│   │
│   └── App.tsx                       # Add LASCO routes
│
└── ...existing files...
```

### VPS Worker (prop8t/lasco-worker/)

Located in the **same monorepo** as the web app (not a separate repo). This is intentional because:
1. Worker needs access to source files for AI analysis
2. Shares same Supabase database/migrations
3. Single source of truth for types and schemas

```
prop8t/
├── app/web/                          # Next.js (Cloudflare Pages)
├── lasco-worker/                     # LASCO Worker (Hetzner VPS)
│   ├── src/
│   │   ├── index.ts                  # Express server entry point
│   │   ├── types.ts                  # TypeScript types
│   │   ├── routes/
│   │   │   └── webhook.ts            # POST /webhook/sentry
│   │   └── services/
│   │       ├── database.ts           # Supabase queue operations
│   │       ├── queue-processor.ts    # Background queue processing
│   │       ├── ai.ts                 # LangChain AI (Anthropic → OpenAI fallback)
│   │       └── github.ts             # Git operations + PR creation
│   ├── package.json
│   ├── tsconfig.json
│   ├── ecosystem.config.cjs          # PM2 config
│   ├── .env.example
│   └── .gitignore
├── supabase/                         # Shared database
└── .github/workflows/
    └── deploy-lasco-worker.yml       # Auto-deploy to VPS
```

### Prop8t App Changes (prop8t/app/web/)

```
app/web/
├── instrumentation.ts                # NEW - Sentry setup
├── sentry.client.config.ts           # NEW - Client Sentry
├── sentry.server.config.ts           # NEW - Server Sentry
│
├── lib/
│   └── tracking/
│       ├── ActivityTracker.ts        # MODIFY - Add timeline capture
│       ├── event-timeline.ts         # NEW - Timeline capture class
│       └── pii-blocklist.ts          # NEW - PII element blocklist
│
└── next.config.ts                    # MODIFY - Wrap with Sentry
```

### Supabase Edge Functions

Add error tracking to all 12 existing edge functions:

```
supabase/functions/
├── _shared/
│   └── error-tracker.ts              # NEW - Error reporting helper
│
├── send_otp/index.ts                 # MODIFY - Add error tracking
├── verify_otp/index.ts               # MODIFY - Add error tracking
├── validate-property-v2/index.ts     # MODIFY - Add error tracking
├── ... (all 12 functions)
```

---

## PII Sanitization

Blocklist elements for click tracking:

```typescript
// lib/tracking/pii-blocklist.ts
const PII_BLOCKLIST_SELECTORS = [
  'input[type="password"]',
  'input[type="email"]',
  'input[type="tel"]',
  'input[name*="card"]',
  'input[name*="cvv"]',
  'input[name*="ssn"]',
  '[data-sensitive]',
  '[data-no-track]',
  '.sensitive',
  '.private',
];

export function shouldTrackClick(element: Element): boolean {
  return !PII_BLOCKLIST_SELECTORS.some(selector =>
    element.matches(selector) || element.closest(selector)
  );
}
```

---

## Slack Notifications

### Message Format

```
🚨 New Blocking Error
━━━━━━━━━━━━━━━━━━━━━━
TypeError: Cannot read property 'id' of undefined
Source: client | Occurrences: 15 | Users: 8
Location: components/PropertyCard.tsx:142

🤖 AI Status: Investigating...

[Know More]
```

### "Know More" Thread Reply

When clicked, sends thread reply with:

```
📋 Error Details
━━━━━━━━━━━━━━━━━━━━━━
Root Cause: Property data accessed before async load completed

Affected Component: PropertyCard
Related Files:
- components/PropertyCard.tsx:142
- hooks/usePropertyData.ts:28

Fix Status: ✅ Committed to lasco branch
Commit: abc123
Test: ✅ Generated and committed

🔗 View in Dashboard: https://admin.prop8t.ai/lasco/errors/xxx
```

### Escalation Alert (Unfixable)

```
⚠️ ESCALATION: AI Cannot Fix This Error
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TypeError: Cannot read property 'id' of undefined

🤖 AI Analysis:
This error requires human context - it appears to be a race condition
in the authentication flow that needs architectural review.

Investigation ID: xxx
Human attention required.

🔗 View Details: https://admin.prop8t.ai/lasco/errors/xxx
```

---

## Dashboard UI Specifications

### Error List Page (/lasco/errors)

- **Sort:** Recent first (last_seen_at DESC)
- **Filters:** Status, Severity, Source
- **Refresh:** Manual (no realtime)
- **Columns:** Error type, message, occurrences, users affected, status, last seen

### Error Detail Page (/lasco/errors/:id)

- **Timeline View:** Full chronological timeline with layer filters (user/network/frontend/backend)
- **Stack Trace:** Collapsible, syntax highlighted
- **AI Investigation:** Expandable section with full analysis
- **Fix Status:** Current status, commit SHA, test results

### Diff Viewer

- **Style:** Inline unified diff (single column, +/- lines)
- **Syntax highlighting:** Yes
- **Show:** AI explanation above diff

---

## Environment Variables

### VPS Worker (lasco-worker/.env)

```bash
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# AI Providers (LangChain)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# GitHub
GITHUB_TOKEN=
GITHUB_REPO_OWNER=propzing
GITHUB_REPO_NAME=prop8t
GITHUB_LASCO_BRANCH=lasco

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_BOT_TOKEN=                    # Bot token for thread replies (xoxb-...) - optional
SLACK_CHANNEL=#errors               # Default channel for notifications
SLACK_SIGNING_SECRET=               # For verifying interactive requests (optional)
ADMIN_DASHBOARD_URL=https://admin.prop8t.ai  # For dashboard links in messages

# Server
PORT=3000
NODE_ENV=production
```

### Prop8t App (app/web/.env)

```bash
# Existing vars...

# Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# LASCO Timeline
LASCO_WEBHOOK_URL=https://lasco-api.prop8t.ai/webhook/timeline
```

---

## VPS Deployment

### Hetzner Setup (One-Time)

1. Create CX11 VPS (2 vCPU, 4GB RAM, ~€4/mo)
2. Point `lasco-api.prop8t.ai` to VPS IP
3. Install Node.js 20 LTS
4. Install PM2: `npm install -g pm2`
5. Setup Let's Encrypt SSL with certbot
6. Clone full repo: `git clone git@github.com:propzing/prop8t.git /var/www/prop8t`
7. Setup SSH deploy key for GitHub Actions
8. Configure `.env` in `/var/www/prop8t/lasco-worker/`
9. Initial start:
   ```bash
   cd /var/www/prop8t/lasco-worker
   npm install
   npm run build
   pm2 start ecosystem.config.cjs --env production
   pm2 save
   pm2 startup
   ```

### GitHub Actions Auto-Deploy

Deployment is automated via `.github/workflows/deploy-lasco-worker.yml`:

- **Triggers:** Push to `main` or `staging` (only when `lasco-worker/**` changes)
- **Manual trigger:** Available via workflow_dispatch

**Required GitHub Secrets:**
| Secret | Description |
|--------|-------------|
| `LASCO_VPS_HOST` | VPS IP or hostname |
| `LASCO_VPS_USER` | SSH user (e.g., `deploy`) |
| `LASCO_VPS_SSH_KEY` | Private SSH key |
| `LASCO_VPS_PORT` | SSH port (default: 22) |
| `SLACK_WEBHOOK_URL` | For failure notifications |

**Deployment Flow:**
```
Push to main/staging → GitHub Actions → SSH to VPS → git pull →
npm ci → npm run build → pm2 restart → Health check
```

### PM2 Config

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'lasco-worker',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
  }]
};
```

### Worker Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook/sentry` | POST | Receives Sentry error webhooks |
| `/webhook/timeline` | POST | Receives LASCO event timelines from client |
| `/webhook/edge-function` | POST | Receives errors from Supabase Edge Functions |
| `/webhook/slack/interactive` | POST | Handles Slack interactive messages (Know More button) |
| `/webhook/health` | GET | Webhook health check |
| `/health` | GET | Server health + queue stats |
| `/admin/enable` | POST | Enable LASCO (kill switch) |
| `/admin/disable` | POST | Disable LASCO (kill switch) |
| `/admin/stats` | GET | Queue statistics |
| `/admin/test` | GET | Test AI + GitHub connections |
| `/admin/process` | POST | Manually process queue |

---

## Implementation Phases

### Phase 1: Database + Sentry Setup ✅ COMPLETE
- [x] Add LASCO tables to Supabase (migration)
  - `fix_queue` - Sequential processing queue with DB lock
  - `lasco_config` - System configuration (kill switch)
  - `auto_fixes` - Track generated fixes and PRs
  - `acquire_queue_lock()` / `release_queue_lock()` functions
- [x] Install @sentry/nextjs in prop8t
- [x] Configure client/server/edge Sentry SDKs
  - `instrumentation-client.ts` - Client-side with ActivityTracker integration
  - `sentry.server.config.ts` - Server-side
  - `sentry.edge.config.ts` - Edge runtime (middleware)
- [x] Link errors to existing visitor fingerprints (via Sentry tags)
- [x] Update CSP in middleware.ts for Sentry domains
- [x] Test error capture flow

### Phase 2: LASCO Worker + GitHub Integration ✅ COMPLETE
- [x] Create lasco-worker in monorepo (`prop8t/lasco-worker/`)
- [x] Setup Express server with webhook endpoints
- [x] Implement Sentry webhook handler (`/webhook/sentry`)
- [x] Implement queue processor with database locking
- [x] Integrate LangChain AI (Anthropic → OpenAI fallback)
- [x] Implement GitHub integration (branch, commits, PRs)
- [x] Add PM2 configuration for deployment
- [x] Create GitHub Actions workflow for auto-deploy

### Phase 3: Event Timeline Capture ✅ COMPLETE
- [x] Extend existing ActivityTracker with timeline capture
  - `EventTimeline` class captures rich event data
  - Integrated into ActivityTracker initialization
- [x] Implement PII blocklist for click tracking
  - `pii-blocklist.ts` with CSS selectors for sensitive elements
  - URL sanitization, header sanitization
  - Element path tracking without sensitive values
- [x] Capture navigation, clicks, network requests/responses
  - Navigation: pushState, replaceState, popstate
  - Clicks: with element info and PII filtering
  - Network: patched fetch and XMLHttpRequest
  - Console: error and warn capture
- [x] Capture errors with bug categorization
  - Global error handler
  - Unhandled promise rejection
  - Bug severity classification (blocking/annoying/warning/info)
- [x] Send timeline on error occurrence only
  - Integrated with Sentry `beforeSend` hook
  - `lasco-client.ts` sends to worker endpoint
  - Timeline summary added to Sentry context

### Phase 4: Admin Dashboard UI ✅ COMPLETE
- [x] Add "LASCO" sidebar section
  - Added to `DashboardLayout.tsx` menuItems
  - Bug/warning icon with path `/lasco`
- [x] Create ErrorsPage with list + filters
  - `components/lasco/ErrorsPage.tsx`
  - Status filters (all/pending/processing/completed/failed/skipped)
  - Stats dashboard (total, pending, processing, completed, failed)
  - Error list with priority, status badges, file path
- [x] Create ErrorDetailPage with timeline viewer
  - `components/lasco/ErrorDetailPage.tsx`
  - Stack trace viewer (collapsible)
  - Auto-fix status with PR link
  - Event timeline with layer filters (user/network/frontend)
- [x] Create FixesPage with inline unified diffs
  - `components/lasco/FixesPage.tsx`
  - Simple diff viewer component (added/removed lines)
  - Fix list with status badges
  - PR links to GitHub
  - Test code viewer (collapsible)
- [x] Create SettingsPage with kill switch
  - `components/lasco/SettingsPage.tsx`
  - Master enable/disable toggle
  - AI provider selector (Anthropic/OpenAI)
  - Worker status indicator
  - All config table view
  - Danger zone (clear pending queue)

### Phase 5: Slack Integration ✅ COMPLETE
- [x] Setup Slack webhook service
  - `services/slack.ts` with webhook and Bot API support
  - Supports both incoming webhooks and bot token for thread replies
- [x] Create notification templates
  - New error notification with severity badges
  - Processing started notification
  - Fix generated notification with AI explanation
  - PR created notification with GitHub link
  - Escalation alert for unfixable errors
  - Processing failed notification
- [x] Implement "Know More" button with thread replies
  - Interactive button sends thread reply with full details
  - `/webhook/slack/interactive` endpoint for button handling
  - Includes stack trace, fix status, and dashboard link
- [x] Implement escalation alerts
  - Special notification when AI cannot fix an error
  - Human attention required message with analysis

### Phase 6: Edge Function Tracking ✅ COMPLETE
- [x] Create shared error-tracker.ts for Deno
  - `_shared/lasco-tracker.ts` with full Deno/Edge runtime support
  - `withLascoTracking()` wrapper for easy integration
  - `createLascoHandler()` with CORS and error handling
  - `trackError()` and `trackMessage()` functions
- [x] Add edge function webhook endpoint to lasco-worker
  - `POST /webhook/edge-function` receives errors from edge functions
  - Auto-queues errors for AI analysis
  - Sends Slack notifications
- [x] Migration guide created
  - `_shared/LASCO_MIGRATION.md` with examples and checklist

### Phase 7: VPS Setup & Deployment ✅ COMPLETE (Documentation)
- [x] VPS setup guide created
  - `lasco-worker/docs/VPS_SETUP.md` with step-by-step instructions
  - Hetzner CX11 recommendation (~€4/month)
  - Node.js 20 + PM2 setup
  - SSL with Let's Encrypt
- [x] Nginx configuration
  - `lasco-worker/docs/nginx.conf` ready to copy
  - Reverse proxy with SSL termination
  - Proper timeouts for AI calls (300s)
- [x] GitHub Secrets documented
  - `LASCO_VPS_HOST`, `LASCO_VPS_USER`, `LASCO_VPS_SSH_KEY`, `LASCO_VPS_PORT`
- [x] Sentry webhook configuration documented

### Phase 8: Testing & Polish ✅ COMPLETE
- [x] End-to-end test script
  - `lasco-worker/scripts/test-pipeline.sh`
  - Tests health, webhooks, timeline endpoints
- [x] 30-day timeline cleanup job
  - `supabase/migrations/20240131_lasco_cleanup_job.sql`
  - `lasco_delete_old_timelines()` function
  - `lasco_cleanup_old_queue_items()` (7 days)
  - `lasco_run_all_cleanup()` combined function
  - pg_cron schedule ready (uncomment after enabling extension)
- [x] Security measures
  - PII blocklist in event timeline capture
  - URL and header sanitization
  - Sentry webhook signature verification
  - Slack signing secret verification (optional)

---

## Cost Estimates

| Component | Monthly Cost |
|-----------|--------------|
| Hetzner VPS (CX11) | ~€4 |
| Supabase Free Tier | $0 |
| Sentry Free Tier (5K errors) | $0 |
| Anthropic API (Claude Sonnet) | ~$10-50 (usage dependent) |
| OpenAI API (fallback) | ~$5-20 (fallback only) |
| GitHub (existing) | $0 |
| Slack (existing) | $0 |
| **Total** | **~$20-75/mo** |

---

## Summary

**What LASCO does:**
1. **Captures** rich Sonarly-style event timelines for error sessions
2. **Receives** errors from Sentry (Next.js app) and edge functions
3. **Investigates** using LangChain (Claude/GPT-4 with fallback)
4. **Generates** code fixes + tests automatically
5. **Commits** to `lasco` branch (human creates PR to staging)
6. **Notifies** via Slack with "Know More" for details

**The autonomous flow:**
```
Error occurs → Sentry → VPS webhook → Queue (locked) → AI investigate
    → AI write fix + test → Commit to lasco → GitHub Actions tests
    → Slack notification → Human reviews → PR to staging
```

**Key architecture decisions:**
- VPS (not serverless) for long-running AI calls
- LangChain for model flexibility
- Queue + lock for sequential fix processing
- Force-reset lasco branch after staging merge
- Tests required, run via GitHub Actions
- Slack only (no email)
- Database kill switch for emergencies
- 30-day timeline retention with auto-delete
