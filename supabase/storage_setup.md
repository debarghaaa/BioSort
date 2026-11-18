# Private Evidence Storage Setup (`waste-evidence`)

## 1. Bucket Configuration

- **Bucket ID**: `waste-evidence`
- **Visibility**: **Private** (`public = FALSE`). Evidence images must never be exposed via public bucket URLs.
- **Accepted Formats**: `image/jpeg`, `image/png` (enforced both on FastAPI upload validation and at Supabase Storage bucket configuration).
- **Maximum File Size**: `10 MiB` (`10485760` bytes).

## 2. Object Path Convention

- Never store raw image bytes in PostgreSQL. Only store the private object path inside `classification_events.image_object_path`.
- Use unique, collision-free object paths partitioned by user ID and classification UUID:
  `{created_by_uuid}/{classification_uuid}.{ext}` (for FastAPI service-role uploads or direct authenticated uploads matching `(storage.foldername(name))[1] = auth.uid()::text`).

## 3. Authorised Short-Lived Signed URLs

When displaying an image for review or history inspection:
1. Do not expose `SUPABASE_SERVICE_ROLE_KEY` in the browser.
2. Request a short-lived signed URL (recommended TTL: `60`–`300` seconds) using either:
   - An authorised authenticated Supabase client (`supabase.storage.from('waste-evidence').createSignedUrl(path, 120)`), governed by the `storage.objects` RLS policy restricting reads to the uploader (`created_by`) or `reviewer`/`admin` roles, or
   - A dedicated authenticated backend endpoint using the server-side Supabase client after verifying the user's role.

## 4. Configurable Retention Policy

- `public.retention_policies` stores `policy_key = 'waste_evidence_images'` with a configurable `retention_days` integer (default `90` days, editable strictly by `admin`).
- A scheduled backend maintenance job calls `public.list_expired_evidence_paths()` using the server-side service role, removes expired objects from `waste-evidence`, and nullifies or archives expired `image_object_path` references according to institutional compliance rules.
