-- Supabase Storage needs a SELECT rule (not just DELETE) before it can remove a file.
-- Let uploaders "see" their own photos so the "remove photo" button in MemeMatch works.
-- Everyone else still views photos through the public URL; listing the bucket stays closed.
drop policy if exists "uploader reads own game images" on storage.objects;
create policy "uploader reads own game images" on storage.objects for select to authenticated
  using (bucket_id = 'game-images' and owner_id = auth.uid()::text);
