# Dry Run Payload Analysis

## Issues Found in Your Dry Run Payload

### 1. **Blob URLs in All Media Files** ⚠️
**Status:** Expected in development mode, but will be filtered out during submission

All your media files have blob URLs:
- `cover.url`: `blob:http://localhost:5173/...`
- `video_url`: `blob:http://localhost:5173/...`
- `brochure_url`: `blob:http://localhost:5173/...`
- `layouts_pdf`: `blob:http://localhost:5173/...`
- `buildings[0].image_url`: `blob:http://localhost:5173/...`
- `unit_blocks[0].typical_unit_image_url`: `blob:http://localhost:5173/...`
- `facilities[1].image_url`: `blob:http://localhost:5173/...`

**What happens:**
- ✅ In **development mode**: These will be filtered out during insertion (won't cause errors)
- ❌ In **production mode**: Submission will be blocked until files are properly uploaded

**Solution:** The code now:
1. Checks for blob URLs in ALL fields (not just main media)
2. Shows a comprehensive list of all blob URLs before submission
3. Filters them out during insertion (so they won't be saved to database)

### 2. **Payment Plan Format** ✅
**Status:** Will work, but could be improved

Your payment plan has:
```json
{
  "plan_name": "qwwer",
  "months_after_handover": 1232,
  "payment_steps": "sadfafsdfa"
}
```

**What happens:**
- The code will parse `payment_steps` and create a JSONB array with a single step
- Result in database: `payments: [{"step": 1, "description": "sadfafsdfa", "percentage": null}]`

**Recommendation:** For multiple payment steps, use comma or pipe separators:
- `"10% down, 20% on booking, 30% during construction, 40% on handover"`
- Or: `"10% down|20% on booking|30% during construction|40% on handover"`

### 3. **Developer Data** ✅
**Status:** Fine - using `developer_id` instead

Your payload has:
```json
{
  "developer": null,
  "developer_data": { "name": "", ... }
}
```

**What happens:**
- If you're using `developer_id` in the form, this is fine
- The `developer_data` will be ignored if `developer` is null
- The property will use the `developer_id` from the form

### 4. **Duplicate Facility Names** ⚠️
**Status:** Will work, but might cause confusion

You have 4 facilities all named "test project":
```json
"facilities": [
  { "name": "test project", ... },
  { "name": "test project", ... },
  { "name": "test project", ... },
  { "name": "test project", ... }
]
```

**What happens:**
- All 4 will be created/linked to the property
- They'll all have the same name in the database
- This might make it hard to distinguish them later

**Recommendation:** Use unique names for each facility

### 5. **Map Points** ✅
**Status:** Looks good!

```json
"map_points": [
  {
    "name": "23asdfasfd",
    "distance_km": 234234
  }
]
```

**What happens:**
- Will be inserted correctly
- The code will automatically find a `source_id` for it

## What Will Actually Be Saved

When you submit (not dry run), here's what will be saved:

### ✅ Will Be Saved:
- ✅ Property basic info (name, slug, area, city, etc.)
- ✅ Pricing information
- ✅ Unit blocks (with all fields)
- ✅ Payment plans (with parsed steps)
- ✅ Facilities (all 4, even with duplicate names)
- ✅ Map points
- ✅ Buildings (but image_url will be null if it's a blob URL)

### ❌ Will NOT Be Saved (filtered out):
- ❌ All blob URLs (cover, video, brochure, layouts, building images, unit images, facility images)
- ❌ Empty developer_data (since developer is null)

## Recommendations

1. **For Production:**
   - Ensure all files are uploaded to R2/storage before submission
   - The form will block submission if blob URLs are detected in production

2. **For Development:**
   - Blob URLs are expected (from R2 mock)
   - They'll be filtered out automatically
   - You can still test the submission flow

3. **Payment Plans:**
   - Use comma or pipe separators for multiple steps
   - Example: `"10% down, 20% on booking, 70% on handover"`

4. **Facilities:**
   - Use unique, descriptive names
   - Example: `"Swimming Pool"`, `"Gym"`, `"Parking"`, etc.

## Testing

After submission, use this SQL to verify what was saved:

```sql
-- Replace 2222 with your property ID
SELECT 
  p.*,
  (SELECT jsonb_agg(row_to_json(pi.*)) FROM property_images pi WHERE pi.property_id = p.id) as images,
  (SELECT jsonb_agg(row_to_json(pp.*)) FROM property_payment_plans pp WHERE pp.property_id = p.id) as payment_plans,
  (SELECT jsonb_agg(row_to_json(ub.*)) FROM property_unit_blocks ub WHERE ub.property_id = p.id) as units,
  (SELECT jsonb_agg(row_to_json(pb.*)) FROM property_buildings pb WHERE pb.property_id = p.id) as buildings
FROM properties p
WHERE p.id = 2222;
```

