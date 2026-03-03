# Changelog

All notable changes to the admin dashboard are documented here. Updated after every push.

## 2026-03-03

### feat: add developer_website_clicked event labels and colors (`5f966a6`)

- AnalyticsOverviewPage: added "Website Clicked" label for `developer_website_clicked`
- RealtimePage: added orange color and label for `developer_website_clicked` event

---

### feat: add impressions + CTR columns and new event labels (`1c16183`)

**PropertyAnalyticsPage**
- Added `Impressions` and `CTR%` columns to the property analytics table
- CTR calculated as `cardClicks / impressions * 100`
- Added "Sort by Impressions" option to sort dropdown
- Counts `property_card_impression` events in the aggregation switch
- Updated CSV export to include Impressions and CTR% columns

**AnalyticsOverviewPage**
- Added 3 new entries to EVENT_LABELS: Card Impression, Developer Page View, Developer Property Click

**RealtimePage**
- Added 3 new entries to EVENT_COLORS: indigo for impressions, orange for developer events
- Added 3 new entries to EVENT_LABELS matching the new event types

---

## 2026-02-20

### feat: add Deep Research & Chat analytics pages, enhance funnels and realtime (`5c89485`)

**New Pages**
- DeepResearchAnalyticsPage: KPIs (reports generated, PDF downloads, auth block rate, completion rate), funnel (opened -> submitted -> viewed -> downloaded), questionnaire preferences pie chart, daily trend line chart, top researched properties table
- ChatAnalyticsPage: KPIs (messages sent, avg response time, suggested query click rate, error rate), engagement funnel (sent -> received -> source clicked -> suggested query), daily volume bar chart, response time distribution, popular suggested queries table
- Added Deep Research and Chat tabs to AnalyticsTabs (7 tabs total)
- Registered `/analytics/deep-research` and `/analytics/chat` routes

**Enhanced Funnels (AnalyticsOverviewPage)**
- Auth funnel expanded from 2 to 5 steps: Anonymous Visitors -> Portal Time Triggered -> Signup Initiated -> OTP Sent -> Authenticated
- Full conversion funnel expanded from 5 to 7 steps: added Deep Research and Contacted stages
- EVENT_LABELS expanded from 8 to 40 entries covering all new event types

**Contact Metrics (PropertyAnalyticsPage)**
- Added Calendly Clicks and WhatsApp Clicks columns to the property analytics table
- Included in CSV export

**Realtime Event Colors (RealtimePage)**
- Added 30+ color-coded EVENT_COLORS by category: purple (deep research), blue (chat), green (auth), orange (contact), cyan (voice), amber (map)
- EVENT_LABELS expanded from 10 to 42 entries

---

## 2026-02 (earlier)

### refactor: clean up overview page and enhance journey explorer (`33a1802`)
- Cleaned up analytics overview page layout
- Enhanced journey explorer component

### feat: add persistent tab navigation across all analytics pages (`36a561b`)
- Tab navigation persists across analytics pages

### fix: use 2-col funnel grid and replace pie with donut + legend (`f1c7f6e`)
- Funnel grid now 2-column layout
- Replaced pie chart with donut chart + legend

### feat: redesign funnel chart with SVG funnel shape and stats table (`7439dfc`)
- New SVG-based funnel visualization with accompanying stats table

### feat: add user behavior funnels and journey explorer (`938de75`)
- User behavior funnel analytics
- Journey explorer for tracking user paths

### feat: add funnel visualization and search analytics (`2b9f64a`)
- Funnel visualization component
- Search analytics tracking

### fix: use actual database statuses in dropdown (`09c5735`)
- Property status dropdown now uses real DB values

### feat: add inline status editing for properties (`1ef39df`)
- Properties can now have their status edited inline from the dashboard
