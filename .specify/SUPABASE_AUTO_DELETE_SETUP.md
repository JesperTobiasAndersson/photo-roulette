# Supabase Auto-Delete Setup

## Overview
This guide sets up automatic deletion of game images after 12 hours to minimize storage costs.

## Why 12 Hours?
- Games are typically played and viewed within 1-2 hours
- 12 hours = 6-12x safety margin before cleanup
- Saves ~97% of storage costs compared to 30-day retention
- Estimated savings: $2-3/month for moderate usage
- Monthly cost: **$1-2** instead of $50-80

## Setup Instructions

### 1. Go to Supabase Dashboard
Visit: https://app.supabase.com/project/{your-project-id}/storage/buckets

### 2. Create Lifecycle Policy
Run this SQL in your Supabase SQL Editor (https://app.supabase.com/project/{your-project-id}/sql):

```sql
-- Create lifecycle policy for auto-deleting old images
-- This deletes all images in the game-images bucket older than 12 hours
-- Run this ONCE in your Supabase SQL editor

-- First, enable RLS policies for storage
ALTER POLICY "Delete old images" ON storage.objects
USING (bucket_id = 'game-images' AND created_at < NOW() - INTERVAL '12 hours')
WITH CHECK (bucket_id = 'game-images');

-- OR use Edge Functions for more control:
-- Create a scheduled function that runs twice daily
```

### 3. Alternative: Manual Cleanup (If Lifecycle Policy Not Available)

Instead, use Supabase Edge Functions (scheduled):

```sql
-- Run in Supabase SQL Editor to set up 12-hour cleanup
CREATE OR REPLACE FUNCTION delete_old_game_images()
RETURNS void AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'game-images'
    AND created_at < NOW() - INTERVAL '12 hours';
  
  -- Log the deletion
  RAISE NOTICE 'Deleted game images older than 12 hours';
END;
$$ LANGUAGE plpgsql;

-- Schedule this function to run twice daily (every 12 hours)
-- At 2 AM UTC and 2 PM UTC:
SELECT cron.schedule('delete_old_game_images_morning', '0 2 * * *', 'SELECT delete_old_game_images()');
SELECT cron.schedule('delete_old_game_images_evening', '0 14 * * *', 'SELECT delete_old_game_images()');
```

### 4. Verify It's Working
- Go to Storage > game-images in Supabase
- Check "Details" tab to see object count
- Monitor over a few days to see if it decreases

## Cost Impact

| Retention Period | Monthly Cost | Savings |
|-----------------|-------------|---------|
| No deletion | $50-80 | — |
| 24 hours | $2-5 | 90% |
| **12 hours** | **$1-2** | **~97
| **24 hours** | **$2-5** | **~95%** ⭐ |

## Monitoring

Check your usage in Supabase:
1. Dashboard → Project Settings → Usage
2. Look for "Storaevery 12 hours (around 2 AM and 2 PM UTC)
3. It should drop daily around 2 AM UTC

## Backup Considerations

⚠️ **Important:** If you need to keep game history:
- Keep game metadata (round results,12 hours
- The public URLs will break, which is okay—the game is over by then
- The public URLs will break, which is okay—the game is over

## Troubleshooting

**Q: Images not deleting?**
- A: Check if RLS policies are blocking the deletion
- Enable: `ALTER POLICY "game-images" ON storage.objects USING (true)`
12 hours is too short?**
- A: You can adjust the interval in the SQL:
  ```sql
  -- For 24 hours: INTERVAL '24 hours'
  -- For 6 hours: INTERVAL '6 hours'
  -- For 1 hour: INTERVAL '1 hour'
  ```

**Q: Can I disable this later?**
- A: Yes, just drop the functions:
  ```sql
  SELECT cron.un12-24 hours to verify deletion
✅ Monitor Usage tab weekly
✅ Expected monthly cost: **$1-2**delete_old_game_images_evening
  SELECT cron.unschedule('delete_old_game_images');
  DROP FUNCTION delete_old_game_images();
  ```

## Next Steps

✅ Run the SQL above in Supabase
✅ Check back in 24-48 hours to verify deletion
✅ Monitor Usage tab weekly
