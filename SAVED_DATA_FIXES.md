# Fixes for Saved Data Issues

## Issues Found in Saved Data

### 1. ✅ **Blob URLs Still Being Saved** - FIXED
**Problem:** Blob URLs were being saved in:
- `buildings[0].image_url`: `"blob:http://localhost:5173/..."`
- `unit_blocks[0].typical_image_url`: `"blob:http://localhost:5173/..."`
- `unit_blocks[0].typical_unit_image_url`: `"blob:http://localhost:5173/..."`

**Fix Applied:**
- ✅ Added blob URL filtering for building `image_url`
- ✅ Added blob URL filtering for unit block `typical_unit_image_url` and `typical_image_url`
- ✅ Added blob URL filtering for facility `image_url`

**Result:** Blob URLs will now be filtered out and saved as `null` instead.

### 2. ⚠️ **Map Points Not Saved** - IMPROVED
**Problem:** `map_points` array is empty `[]` even though dry run showed one map point.

**Possible Causes:**
1. `source_id` lookup failed and fallback value (1) doesn't exist in `data_sources` table
2. Insert failed silently (error logged but submission continued)

**Fix Applied:**
- ✅ Improved `source_id` lookup with better error handling
- ✅ Added multiple fallback strategies for finding a valid `source_id`
- ✅ Better error logging to identify the issue

**To Debug:**
Check browser console for:
- `"Inserting map points:"` - confirms map points are being processed
- `"Map points insertion error:"` - shows the actual error
- `"No source_id found for map points"` - indicates source_id lookup failed

**Solution if source_id is the issue:**
1. Check if `data_sources` table has any records:
   ```sql
   SELECT * FROM data_sources LIMIT 5;
   ```
2. If empty, insert a default source:
   ```sql
   INSERT INTO data_sources (code, name, active) 
   VALUES ('manual', 'Manual Entry', true);
   ```

### 3. ✅ **Images Empty** - EXPECTED BEHAVIOR
**Problem:** `images` array is empty `[]`

**Status:** This is **expected** because:
- Cover image had a blob URL → filtered out
- Additional images (if any) had blob URLs → filtered out
- The code correctly filters blob URLs to prevent saving invalid URLs

**Solution:** Upload images properly to R2/storage before submission. In development, blob URLs are expected from the R2 mock, but they won't be saved.

### 4. ✅ **Payment Plans** - WORKING CORRECTLY
**Status:** Payment plan was saved correctly:
```json
{
  "plan_name": "qwwer",
  "months_after_handover": 1232,
  "payments": [{"step": 1, "percentage": null, "description": "sadfafsdfa"}]
}
```

The `payment_steps` string was correctly parsed into the JSONB `payments` array format.

### 5. ⚠️ **Facilities** - PARTIALLY WORKING
**Problem:** Only 1 facility saved (facility_id: 5808) but dry run showed 4 facilities.

**Possible Causes:**
1. All 4 facilities had the same name "test project"
2. Code found existing facility and reused it
3. Other facilities failed to create/link

**Status:** This might be expected behavior if facilities with the same name are being deduplicated. Check the `facilities` table to see if multiple facilities with name "test project" exist.

## Summary of Changes

### Files Modified:
- `src/utils/propertySubmission.ts`

### Changes Made:
1. ✅ Filter blob URLs from building `image_url`
2. ✅ Filter blob URLs from unit block `typical_unit_image_url` and `typical_image_url`
3. ✅ Filter blob URLs from facility `image_url`
4. ✅ Improved `source_id` lookup for map points with better error handling
5. ✅ Added multiple fallback strategies for finding valid `source_id`

## Testing Recommendations

1. **Test with valid (non-blob) image URLs:**
   - Upload images to R2/storage first
   - Use the returned URLs in the form
   - Verify they're saved correctly

2. **Test map points:**
   - Check browser console for map points insertion logs
   - Verify `data_sources` table has at least one record
   - If map points still fail, check the console error message

3. **Test facilities:**
   - Use unique names for each facility
   - Verify all facilities are saved

4. **Verify blob URL filtering:**
   - Submit with blob URLs
   - Check database - blob URLs should be `null`, not saved

## Next Steps

1. **For Map Points:**
   - Check if `data_sources` table has records
   - If not, create a default source
   - Re-test submission and check console logs

2. **For Images:**
   - In production, ensure all files are uploaded to R2 before submission
   - In development, blob URLs are expected and will be filtered out

3. **For Facilities:**
   - Use unique, descriptive names
   - Check if deduplication is desired behavior

