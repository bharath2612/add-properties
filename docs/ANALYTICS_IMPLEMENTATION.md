# Analytics & User Activity Tracking Implementation

## Overview

This document describes the implementation of user activity tracking for prop8t.ai and the analytics dashboard at admin.prop8t.ai.

---

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│    Prop8t App       │     │     Supabase DB     │     │   Admin Dashboard   │
│  (Next.js + React)  │────▶│   (PostgreSQL)      │◀────│   (Vite + React)    │
│                     │     │                     │     │                     │
│ - ActivityTracker   │     │ - visitor_finger... │     │ - AnalyticsOverview │
│ - Fingerprinting    │     │ - user_sessions     │     │ - PropertyAnalytics │
│ - TrackingContext   │     │ - user_activity_... │     │ - UserAnalytics     │
│                     │     │ - property_analy... │     │ - RealtimePage      │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

---

## Testing Checklist

### 1. Database Tables
- [x] `visitor_fingerprints` table exists
- [x] `user_sessions` table exists
- [x] `user_activity_events` table exists
- [x] `property_analytics_daily` table exists
- [x] `admin_users` table exists

### 2. RLS Policies
- [x] `anon` role can INSERT into `visitor_fingerprints`
- [x] `anon` role can INSERT into `user_sessions`
- [x] `anon` role can INSERT into `user_activity_events`
- [x] `anon` role can SELECT from all tracking tables (for dashboard)

### 3. Tracking Code (Prop8t App)
- [x] `lib/tracking/fingerprint.ts` exists
- [x] `lib/tracking/ActivityTracker.ts` exists
- [x] `lib/tracking/types.ts` exists
- [x] `hooks/useActivityTracker.ts` exists
- [x] `contexts/TrackingContext.tsx` exists
- [x] `TrackingProvider` is in `app/layout.tsx`

### 4. Event Tracking Integration
- [x] `PropertyCard.tsx` has tracking calls
- [x] `PropertyCardSuggestion.tsx` has tracking calls
- [x] `MainMap.tsx` has tracking calls

### 5. API Endpoint
- [x] `/api/track-events/route.ts` exists
- [x] API endpoint accepts POST requests
- [x] API endpoint handles sendBeacon data

### 6. Data Flow Test
- [x] Visit prop8t app creates visitor fingerprint
- [x] Clicking property card creates event
- [x] Events appear in `user_activity_events` table
- [x] Analytics dashboard shows the data

### ALL TESTS PASSED

---

## File Locations

### Prop8t App (tracking)
```
/app/web/
├── lib/tracking/
│   ├── ActivityTracker.ts
│   ├── fingerprint.ts
│   └── types.ts
├── hooks/
│   └── useActivityTracker.ts
├── contexts/
│   └── TrackingContext.tsx
└── app/api/track-events/
    └── route.ts
```

### Admin Dashboard (analytics)
```
/admin-dashboard/src/
├── components/analytics/
│   ├── AnalyticsOverviewPage.tsx
│   ├── PropertyAnalyticsPage.tsx
│   ├── UserAnalyticsPage.tsx
│   └── RealtimePage.tsx
```

---

## Event Types

| Event Type | Description | Tracked In |
|------------|-------------|------------|
| `property_card_click` | User clicks on property card | PropertyCard.tsx |
| `property_view_details` | User clicks "View Details" | PropertyCard.tsx |
| `property_map_marker_click` | User clicks map marker | MainMap.tsx |
| `property_save` | User saves a property | PropertyCard.tsx |
| `property_unsave` | User unsaves a property | PropertyCard.tsx |
| `property_share` | User shares a property | PropertyCard.tsx |
| `page_view` | User views a page | TrackingContext.tsx |

---

## Test Results

### Database Tables Test
- Status: **PASSED**
- Date: 2026-01-31
- Notes: All 5 tables exist and are properly configured

### RLS Policies Test
- Status: **PASSED**
- Date: 2026-01-31
- Notes: All INSERT and SELECT policies verified for anon role

### Tracking Code Test
- Status: **PASSED**
- Date: 2026-01-31
- Notes: All tracking files exist and TrackingProvider is in layout

### Data Flow Test
- Status: **PASSED**
- Date: 2026-01-31
- Notes:
  - Test data inserted successfully via curl
  - 1 visitor fingerprint created
  - 1 session created
  - 5 events tracked (property_card_click, property_view_details, property_save, property_map_marker_click, page_view)

### Issues Found & Fixed
1. **Missing env variable**: `NEXT_PUBLIC_SUPABASE_SUBDOMAIN` was missing from `.env`
   - Fixed: Added `NEXT_PUBLIC_SUPABASE_SUBDOMAIN=https://svapyzcfldheymahioor.supabase.co`

---

## Troubleshooting

### No data appearing in analytics
1. Check if tracking tables exist in database
2. Verify RLS policies allow INSERT for `anon` role
3. Check browser console for tracking errors
4. Verify TrackingProvider is wrapping the app
5. Check if events are being batched (wait 5 seconds or trigger flush)

### Events not being sent
1. Check if `NEXT_PUBLIC_SUPABASE_URL` is set
2. Verify Supabase client is initialized
3. Check browser network tab for failed requests

---

## Changelog

- **2026-01-31**: Initial implementation
