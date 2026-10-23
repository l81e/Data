# Security Hardening & Authentication Architecture Proposal
**MedicineBank Data Platform**  
**Document**: Architectural Decision Record / Security Hardening Plan  
**Status**: Proposed (Awaiting User / Stakeholder Approval)  

---

## 1. Executive Summary

MedicineBank Data is currently a static web application backed by Supabase (Postgres and Storage). In its present architecture:
1. **Client-Side Admin Gate**: The admin passcode (`You want to join US then V73`) is verified in the browser via a SHA-256 hash check.
2. **PostgREST Anon Writes**: Because no Supabase Auth session exists, all database modifications (INSERT, UPDATE, DELETE on `lectures` and `materials`, as well as storage uploads) run with the Supabase Postgres role `anon`.
3. **Uploader Identity**: The columns `uploaded_by` and `created_by` store user display names as plain `TEXT` strings rather than authenticated UUIDs.

While the current setup is functional and backwards-compatible, any technically proficient user can inspect network requests and issue direct HTTP calls to PostgREST or Supabase Storage with the public `anon` key.

This document proposes a **zero-downtime, staged migration** to authentic Supabase Auth with Role-Based Access Control (RBAC) and Row Level Security (RLS).

---

## 2. Target Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │                 End Users                    │
                  │        (Read-Only Students / Public)         │
                  └──────────────────────┬───────────────────────┘
                                         │  SELECT (Role: anon)
                                         ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                           Postgres Database                            │
   │                                                                        │
   │  ┌───────────────┐     ┌────────────────┐     ┌─────────────────────┐  │
   │  │   lectures    │     │   materials    │     │    profiles (RBAC)  │  │
   │  │ (RLS enabled) │     │ (RLS enabled)  │     │  (id UUID, role)    │  │
   │  └───────▲───────┘     └───────▲────────┘     └──────────▲──────────┘  │
   │          │                     │                         │             │
   │          └───────────┬─────────┴─────────────────────────┘             │
   │                      │ Gated by is_admin_or_editor()                   │
   │                      │                                                 │
   └──────────────────────┼─────────────────────────────────────────────────┘
                          │
                          │  INSERT / UPDATE / DELETE
                          │  (Role: authenticated, JWT with user ID)
                          │
                  ┌───────┴──────────────────────────────────────┐
                  │            Editors / Admins                  │
                  │   (Magic Link / Password Auth via Supabase)  │
                  └──────────────────────────────────────────────┘
```

---

## 3. Migration Roadmap

### Phase 4.1: Database Schema & Auth Setup (Non-Breaking)
1. **Enable Supabase Auth**:
   - Enable Email Magic Link or Email/Password provider in the Supabase Dashboard.
   - Invite authorized content editors and administrators.
2. **Create Profiles & Roles**:
   ```sql
   -- Create profiles table linked to auth.users
   CREATE TABLE IF NOT EXISTS public.profiles (
     id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     email TEXT,
     display_name TEXT,
     role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
     created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
     updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
   );

   -- Helper function to check elevated permissions without recursive RLS
   CREATE OR REPLACE FUNCTION public.is_admin_or_editor()
   RETURNS BOOLEAN
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public
   STABLE
   AS $$
   BEGIN
     RETURN EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = auth.uid()
       AND role IN ('editor', 'admin')
     );
   END;
   $$;
   ```
3. **Auto-provisioning Trigger**:
   ```sql
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS trigger AS $$
   BEGIN
     INSERT INTO public.profiles (id, email, display_name, role)
     VALUES (
       new.id,
       new.email,
       coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
       coalesce(new.raw_user_meta_data->>'role', 'viewer')
     );
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   CREATE OR REPLACE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
   ```

### Phase 4.2: Frontend Auth Integration (Dual-Mode)
1. **Implement Supabase Login Modal**:
   - Replace the passcode prompt with Supabase Auth:
     - `supabase.auth.signInWithPassword({ email, password })` or Magic Link.
   - Retain the current display-name chip for students while showing authenticated user badge for logged-in editors.
2. **Dual-Mode Grace Period**:
   - For an interim release period, allow edits from authenticated users, with fallback logging for any remaining client-side passcode actions.

### Phase 4.3: Strict RLS Enforcement (Final Cutover)
Once all editors have accounts, replace the permissive `anon` write policies with strict `is_admin_or_editor()` policies:

```sql
-- Lectures policies
DROP POLICY IF EXISTS "Anon insert lectures" ON public.lectures;
DROP POLICY IF EXISTS "Anon update lectures" ON public.lectures;
DROP POLICY IF EXISTS "Anon delete lectures" ON public.lectures;

CREATE POLICY "Authenticated editors can insert lectures"
  ON public.lectures FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_editor());

CREATE POLICY "Authenticated editors can update lectures"
  ON public.lectures FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_editor())
  WITH CHECK (public.is_admin_or_editor());

CREATE POLICY "Authenticated editors can delete lectures"
  ON public.lectures FOR DELETE
  TO authenticated
  USING (public.is_admin_or_editor());

-- Materials policies
DROP POLICY IF EXISTS "Anon insert materials" ON public.materials;
DROP POLICY IF EXISTS "Anon update materials" ON public.materials;
DROP POLICY IF EXISTS "Anon delete materials" ON public.materials;

CREATE POLICY "Authenticated editors can insert materials"
  ON public.materials FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_editor());

CREATE POLICY "Authenticated editors can update materials"
  ON public.materials FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_editor())
  WITH CHECK (public.is_admin_or_editor());

CREATE POLICY "Authenticated editors can delete materials"
  ON public.materials FOR DELETE
  TO authenticated
  USING (public.is_admin_or_editor());

-- Storage policies
DROP POLICY IF EXISTS "Anon upload materials" ON storage.objects;
DROP POLICY IF EXISTS "Anon update materials" ON storage.objects;
DROP POLICY IF EXISTS "Anon delete materials" ON storage.objects;

CREATE POLICY "Authenticated editors upload materials"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'materials' AND public.is_admin_or_editor());

CREATE POLICY "Authenticated editors update materials"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'materials' AND public.is_admin_or_editor());

CREATE POLICY "Authenticated editors delete materials"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'materials' AND public.is_admin_or_editor());
```

4. **Purge Client Passcode**:
   - Completely remove the SHA-256 passcode verification and modal from the repository.

---

## 4. Operational Risk & Rollback Plan

- **Risk**: If applied prematurely before editors are invited, editors will be locked out of publishing or editing decks.
- **Rollback**: To rollback immediately if needed, re-execute the anon policies in `production_schema.md`.
- **Recommendation**: Keep Phase 4 as a dedicated branch and PR for the next release milestone after the current bugfix release is live and stable.
