# Changelog

All notable changes to the admin dashboard are documented here. Updated after every push.

## 2026-02

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
