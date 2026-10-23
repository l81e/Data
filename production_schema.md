# MedicineBank Production Database Schema & Migration Guide

This document contains the verified production schema configuration for **MedicineBank Data** (`igfooetzorzhhvpakgqa.supabase.co`).

---

## Part 1: Read-Only Verification Queries (Phase 0 / Diagnostic)

Run these queries in the **Supabase SQL Editor** to inspect the current live database state:

```sql
-- 1. Check current enum values for year_of_view
SELECT enum_range(NULL::public.year_of_view) AS year_of_view_values;

-- 2. Inspect materials table columns, data types, and default values
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'materials'
ORDER BY ordinal_position;

-- 3. Inspect lectures table columns, data types, and default values
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'lectures'
ORDER BY ordinal_position;

-- 4. Check foreign keys and ON DELETE action ('c' = CASCADE, 'n' = SET NULL, 'a' = NO ACTION)
SELECT
  conname AS constraint_name,
  conrelid::regclass AS source_table,
  confrelid::regclass AS referenced_table,
  confdeltype AS on_delete_action
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;

-- 5. Check all Row Level Security (RLS) policies on public tables
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6. Check Storage bucket configuration & policies
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'materials';

SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' AND (qual LIKE '%materials%' OR with_check LIKE '%materials%');
```

---

## Part 2: Production Schema & Migration Script (Phase 1)

Run the script below in the **Supabase SQL Editor** to bring the database to the production standard.
This migration is **safe, non-destructive, and 100% backward-compatible** with existing data and running frontend clients.

```sql
-- =============================================================================
-- MedicineBank — Production Schema & Migration (idempotent)
-- Target: Supabase Postgres 15+. Safe to re-run.
-- Contract: matches the deployed frontend (index.html, flashmake.html, flash.html)
--   * uploaded_by / created_by are TEXT display names (no FK)
--   * all browser traffic uses the anon key (no Supabase Auth sessions)
--   * curriculum metadata lives in materials.caption JSON; the normalized
--     columns mirror it and are NULLable so the caption fallback still works
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- 1. Enum: year_of_view
--    CREATE TYPE IF NOT EXISTS never adds values to an existing enum, so each
--    value is added explicitly. (Allowed inside a transaction on PG12+.
--    The new values are not *used* later in this script, so it is safe.)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'year_of_view' AND n.nspname = 'public') THEN
    CREATE TYPE public.year_of_view AS ENUM
      ('first year','second year','third year','fourth year','fifth year','internship');
  END IF;
END $$;

ALTER TYPE public.year_of_view ADD VALUE IF NOT EXISTS 'first year';
ALTER TYPE public.year_of_view ADD VALUE IF NOT EXISTS 'second year';
ALTER TYPE public.year_of_view ADD VALUE IF NOT EXISTS 'third year';
ALTER TYPE public.year_of_view ADD VALUE IF NOT EXISTS 'fourth year';
ALTER TYPE public.year_of_view ADD VALUE IF NOT EXISTS 'fifth year';
ALTER TYPE public.year_of_view ADD VALUE IF NOT EXISTS 'internship';

-- -----------------------------------------------------------------------------
-- 2. profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY,
  name_en    text NOT NULL,
  email      text NOT NULL UNIQUE,
  role       text NOT NULL DEFAULT 'student',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student';

DO $$ BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('student','editor','admin'));
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- -----------------------------------------------------------------------------
-- 3. lectures  (subject / module containers)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lectures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date NOT NULL,
  name            text NOT NULL,
  color           text NOT NULL DEFAULT '#7aaee8',
  created_by      text,                      -- display name, NOT a uuid
  created_by_name text,
  year_of_view    public.year_of_view NOT NULL DEFAULT 'first year',
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.lectures ADD COLUMN IF NOT EXISTS created_by_name text;

-- -----------------------------------------------------------------------------
-- 4. materials  (decks, PDFs, links, media)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materials (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id       uuid,
  type             text NOT NULL,
  kind             text NOT NULL,
  title            text NOT NULL,
  url              text,
  file_name        text,
  caption          text,                     -- JSON: {module,subject,semester,lecture,note,cardCount}
  module_code      text,
  subject_name     text,
  semester         int,                      -- NULL = fall back to caption JSON
  card_count       int DEFAULT 0,
  uploaded_by      text,                     -- display name, NOT a uuid
  uploaded_by_name text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS module_code      text;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS subject_name     text;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS semester         int;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS card_count       int DEFAULT 0;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS uploaded_by_name text;
-- If an earlier migration created semester with DEFAULT 1, remove it:
ALTER TABLE public.materials ALTER COLUMN semester DROP DEFAULT;

DO $$ BEGIN
  ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_type_check;
  ALTER TABLE public.materials ADD CONSTRAINT materials_type_check
    CHECK (type IN ('pdf','q','flashcards','spotify','youtube','link'));

  ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_kind_check;
  ALTER TABLE public.materials ADD CONSTRAINT materials_kind_check
    CHECK (kind IN ('link','upload'));

  ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_semester_check;
  ALTER TABLE public.materials ADD CONSTRAINT materials_semester_check
    CHECK (semester IS NULL OR semester IN (1,2));

  -- Deleting a subject (lectures row) must also delete its materials,
  -- otherwise the app's "delete subject" fails with an FK violation.
  ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_lecture_id_fkey;
  ALTER TABLE public.materials ADD CONSTRAINT materials_lecture_id_fkey
    FOREIGN KEY (lecture_id) REFERENCES public.lectures(id) ON DELETE CASCADE;

  -- Legacy FK from the very first schema (uploaded_by uuid -> profiles) must not exist.
  ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_uploaded_by_fkey;
  ALTER TABLE public.lectures  DROP CONSTRAINT IF EXISTS lectures_created_by_fkey;
END $$;

-- -----------------------------------------------------------------------------
-- 5. flashcard_reviews  (optional FSRS cloud log)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flashcard_reviews (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id        uuid,
  card_id            text NOT NULL,
  rating             smallint NOT NULL CHECK (rating BETWEEN 1 AND 4),
  stability          double precision NOT NULL DEFAULT 0,
  difficulty         double precision NOT NULL DEFAULT 0,
  review_duration_ms integer DEFAULT 0,
  user_id            uuid,
  reviewed_at        timestamptz DEFAULT now()
);

DO $$ BEGIN
  -- Deleting a deck must not be blocked by its review history.
  ALTER TABLE public.flashcard_reviews DROP CONSTRAINT IF EXISTS flashcard_reviews_material_id_fkey;
  ALTER TABLE public.flashcard_reviews ADD CONSTRAINT flashcard_reviews_material_id_fkey
    FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;

  ALTER TABLE public.flashcard_reviews DROP CONSTRAINT IF EXISTS flashcard_reviews_user_id_fkey;
  ALTER TABLE public.flashcard_reviews ADD CONSTRAINT flashcard_reviews_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 6. Backfill normalized columns from caption JSON (caption is the source of truth)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_parse_jsonb(t text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF t IS NULL OR btrim(t) !~ '^\{' THEN RETURN NULL; END IF;
  RETURN t::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

UPDATE public.materials m SET
  module_code  = COALESCE(NULLIF(s.j->>'module',  ''), m.module_code),
  subject_name = COALESCE(NULLIF(s.j->>'subject', ''), m.subject_name),
  semester     = CASE WHEN (s.j->>'semester')  ~ '^[12]$' THEN (s.j->>'semester')::int  ELSE m.semester   END,
  card_count   = CASE WHEN (s.j->>'cardCount') ~ '^\d+$'  THEN (s.j->>'cardCount')::int ELSE m.card_count END
FROM (SELECT id, public.try_parse_jsonb(caption) AS j FROM public.materials) s
WHERE s.id = m.id AND s.j IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 7. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lectures_date          ON public.lectures(date);
CREATE INDEX IF NOT EXISTS idx_lectures_year          ON public.lectures(year_of_view);
CREATE INDEX IF NOT EXISTS idx_lectures_year_name     ON public.lectures(year_of_view, name);
CREATE INDEX IF NOT EXISTS idx_lectures_date_year     ON public.lectures(date, year_of_view);
CREATE INDEX IF NOT EXISTS idx_materials_lecture_id   ON public.materials(lecture_id);
CREATE INDEX IF NOT EXISTS idx_materials_type         ON public.materials(type);
CREATE INDEX IF NOT EXISTS idx_materials_hierarchy    ON public.materials(module_code, subject_name, semester);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_mat  ON public.flashcard_reviews(material_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_user ON public.flashcard_reviews(user_id);

-- -----------------------------------------------------------------------------
-- 8. Role helper (kept for a future move to Supabase Auth; not used by RLS yet)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_or_editor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                 WHERE id = auth.uid() AND role IN ('admin','editor'));
$$;

-- -----------------------------------------------------------------------------
-- 9. Grants + Row Level Security
--    The frontend authenticates admins client-side only, so every request is
--    'anon'. Writes therefore MUST be allowed for anon, or uploads fail.
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lectures, public.materials TO anon, authenticated;
GRANT SELECT, INSERT                 ON public.flashcard_reviews          TO anon, authenticated;
GRANT SELECT                         ON public.profiles                   TO anon, authenticated;

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;

-- Remove every previously-shipped policy name so nothing stale lingers
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename IN ('profiles','lectures','materials','flashcard_reviews')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "profiles_read"      ON public.profiles          FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "profiles_self_upd"  ON public.profiles          FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "lectures_read"      ON public.lectures          FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lectures_insert"    ON public.lectures          FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lectures_update"    ON public.lectures          FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lectures_delete"    ON public.lectures          FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "materials_read"     ON public.materials         FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "materials_insert"   ON public.materials         FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "materials_update"   ON public.materials         FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "materials_delete"   ON public.materials         FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "reviews_read"       ON public.flashcard_reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "reviews_insert"     ON public.flashcard_reviews FOR INSERT TO anon, authenticated WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 10. Storage bucket 'materials' (public read, anon upload)
--     file_size_limit = NULL -> inherits the project's global limit
--     (Free plan = 50 MB; on Pro raise it to 100 MB in Settings -> Storage).
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('materials', 'materials', true, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = NULL;

DROP POLICY IF EXISTS "materials_bucket_read"   ON storage.objects;
DROP POLICY IF EXISTS "materials_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "materials_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "materials_bucket_delete" ON storage.objects;

CREATE POLICY "materials_bucket_read"   ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'materials');
CREATE POLICY "materials_bucket_insert" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'materials');
CREATE POLICY "materials_bucket_update" ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'materials') WITH CHECK (bucket_id = 'materials');
CREATE POLICY "materials_bucket_delete" ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'materials');

-- -----------------------------------------------------------------------------
-- 11. Refresh PostgREST schema cache (fixes PGRST204 "column not in schema cache")
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
```
