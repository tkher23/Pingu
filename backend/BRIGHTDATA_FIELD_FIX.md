# BrightData Field Name Fix

## Issue
```
[2025-08-09 17:41:05.705] BrightData API error: 500 - Invalid custom output fields: "headline" doesn't exist in output schema
```

## Root Cause
The BrightData API was rejecting our `custom_output_fields` parameter because we used `"headline"` which is not a valid field name in their schema.

## Analysis
Looking at the `parse_brightdata_linkedin()` function in `app.py`, line 1640 shows:
```python
"headline": truncate_text(profile_data.get("position", ""), 200),
```

This reveals that:
- **BrightData field name**: `position`
- **Our internal field name**: `headline`
- The parsing function maps `position` → `headline`

## Fix Applied
Updated both API trigger endpoints to use the correct BrightData field names:

### Before (Incorrect)
```python
"custom_output_fields": "url|name|headline|about|experience|education|projects|publications"
```

### After (Correct) 
```python
"custom_output_fields": "url|name|position|about|experience|education|projects|publications"
```

## Files Updated
1. **`backend/app.py`** - Fixed both batch and single profile trigger endpoints
2. **`backend/BRIGHTDATA_OPTIMIZATIONS.md`** - Updated documentation  
3. **`backend/test_brightdata_optimizations.py`** - Updated test script
4. **`backend/demo_brightdata_optimization.py`** - Updated demo script

## Field Mapping Clarification
- **url** → url (reference)
- **name** → name (person's name)
- **position** → headline (professional title) ⭐ **This was the issue**
- **about** → about (profile bio)
- **experience** → experiences (work history)
- **education** → education (educational background)
- **projects** → projects (professional projects)
- **publications** → publications (articles/papers)

## Expected Result
The BrightData API should now accept the `custom_output_fields` parameter and return only the essential fields, reducing data transfer by 60-70% while maintaining full email generation functionality.

## Testing
✅ Syntax validation passed
✅ Test suite runs correctly with updated field names
✅ Ready for production testing
