-- =============================================================================
-- MedicineBank — Production Supabase Schema & Migration
-- Architecture: Clinical Curriculum & Spaced Repetition Workstation
-- Contract: Display-name text uploader columns, nullable semester, anon RLS
-- =============================================================================

-- 1. Ensure year_of_view Enum contains all 6 values
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'year_of_view') THEN
    CREATE TYPE public.year_of_view AS ENUM (
      'first year',
      'second year',
      'third year',
      'fourth year',
      'fifth year',
      'internship'
    );
  ELSE
    ALTER TYPE public.year_of_view ADD VALUE IF NOT EXISTS 'fourth year';
    ALTER TYPE public.year_of_view ADD VALUE IF NOT EXISTS 'fifth year';
    ALTER TYPE public.year_of_view ADD VALUE IF NOT EXISTS 'internship';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Base Tables Definition (Idempotent)
CREATE TABLE IF NOT EXISTS public.lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#7aaee8',
  created_by text,
  created_by_name text,
  year_of_view public.year_of_view NOT NULL DEFAULT 'first year',
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['pdf'::text, 'q'::text, 'flashcards'::text, 'spotify'::text, 'youtube'::text, 'link'::text])),
  kind text NOT NULL CHECK (kind = ANY (ARRAY['link'::text, 'upload'::text])),
  title text NOT NULL,
  url text NOT NULL,
  file_name text,
  caption text,
  module_code text,
  subject_name text,
  semester int,
  card_count int DEFAULT 0,
  uploaded_by text,
  uploaded_by_name text,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Add Normalized Columns & Adjust Existing Constraints (if upgrading existing DB)
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS module_code text;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS subject_name text;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS semester int;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS card_count int DEFAULT 0;

-- Ensure semester is nullable with NO default (prevents forcing arbitrary semester)
ALTER TABLE public.materials ALTER COLUMN semester DROP DEFAULT;

-- Ensure uploader columns are text (never uuid)
DO $$ BEGIN
  ALTER TABLE public.materials ALTER COLUMN uploaded_by TYPE text USING uploaded_by::text;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.lectures ALTER COLUMN created_by TYPE text USING created_by::text;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4. Foreign Key Constraints with ON DELETE CASCADE
DO $$
DECLARE
  c_name text;
BEGIN
  FOR c_name IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.materials'::regclass
      AND confrelid = 'public.lectures'::regclass
      AND contype = 'f'
  ) LOOP
    EXECUTE 'ALTER TABLE public.materials DROP CONSTRAINT ' || quote_ident(c_name);
  END LOOP;
END $$;

ALTER TABLE public.materials
  ADD CONSTRAINT fk_materials_lecture
  FOREIGN KEY (lecture_id) REFERENCES public.lectures(id) ON DELETE CASCADE;

-- If flashcard_reviews exists, ensure CASCADE on materials
DO $$
DECLARE
  c_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'flashcard_reviews') THEN
    FOR c_name IN (
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.flashcard_reviews'::regclass
        AND confrelid = 'public.materials'::regclass
        AND contype = 'f'
    ) LOOP
      EXECUTE 'ALTER TABLE public.flashcard_reviews DROP CONSTRAINT ' || quote_ident(c_name);
    END LOOP;

    ALTER TABLE public.flashcard_reviews
      ADD CONSTRAINT fk_flashcard_reviews_material
      FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_lectures_date ON public.lectures(date);
CREATE INDEX IF NOT EXISTS idx_lectures_year ON public.lectures(year_of_view);
CREATE INDEX IF NOT EXISTS idx_materials_lecture_id ON public.materials(lecture_id);
CREATE INDEX IF NOT EXISTS idx_materials_type ON public.materials(type);
CREATE INDEX IF NOT EXISTS idx_materials_hierarchy ON public.materials(module_code, subject_name, semester);

-- 6. Row Level Security (RLS) with Anon Write Policies
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Clean existing policies on lectures
DROP POLICY IF EXISTS "Public lectures read" ON public.lectures;
DROP POLICY IF EXISTS "Admin lectures insert" ON public.lectures;
DROP POLICY IF EXISTS "Admin lectures update" ON public.lectures;
DROP POLICY IF EXISTS "Admin lectures delete" ON public.lectures;
DROP POLICY IF EXISTS "Anon lectures insert" ON public.lectures;
DROP POLICY IF EXISTS "Anon lectures update" ON public.lectures;
DROP POLICY IF EXISTS "Anon lectures delete" ON public.lectures;

-- Create anon-compatible policies on lectures
CREATE POLICY "Public lectures read" ON public.lectures FOR SELECT USING (true);
CREATE POLICY "Anon lectures insert" ON public.lectures FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon lectures update" ON public.lectures FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anon lectures delete" ON public.lectures FOR DELETE USING (true);

-- Clean existing policies on materials
DROP POLICY IF EXISTS "Public materials read" ON public.materials;
DROP POLICY IF EXISTS "Admin materials insert" ON public.materials;
DROP POLICY IF EXISTS "Admin materials update" ON public.materials;
DROP POLICY IF EXISTS "Admin materials delete" ON public.materials;
DROP POLICY IF EXISTS "Anon materials insert" ON public.materials;
DROP POLICY IF EXISTS "Anon materials update" ON public.materials;
DROP POLICY IF EXISTS "Anon materials delete" ON public.materials;

-- Create anon-compatible policies on materials
CREATE POLICY "Public materials read" ON public.materials FOR SELECT USING (true);
CREATE POLICY "Anon materials insert" ON public.materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon materials update" ON public.materials FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anon materials delete" ON public.materials FOR DELETE USING (true);

-- Flashcard reviews RLS (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'flashcard_reviews') THEN
    ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public reviews read" ON public.flashcard_reviews;
    DROP POLICY IF EXISTS "Public reviews insert" ON public.flashcard_reviews;
    DROP POLICY IF EXISTS "Anon reviews update" ON public.flashcard_reviews;
    DROP POLICY IF EXISTS "Anon reviews delete" ON public.flashcard_reviews;
    CREATE POLICY "Public reviews read" ON public.flashcard_reviews FOR SELECT USING (true);
    CREATE POLICY "Public reviews insert" ON public.flashcard_reviews FOR INSERT WITH CHECK (true);
    CREATE POLICY "Anon reviews update" ON public.flashcard_reviews FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "Anon reviews delete" ON public.flashcard_reviews FOR DELETE USING (true);
  END IF;
END $$;

-- 7. Storage Bucket & Policies for 'materials'
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public materials storage read" ON storage.objects;
DROP POLICY IF EXISTS "Public materials storage insert" ON storage.objects;
DROP POLICY IF EXISTS "Public materials storage update" ON storage.objects;
DROP POLICY IF EXISTS "Public materials storage delete" ON storage.objects;

CREATE POLICY "Public materials storage read" ON storage.objects
  FOR SELECT USING (bucket_id = 'materials');

CREATE POLICY "Public materials storage insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'materials');

CREATE POLICY "Public materials storage update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'materials') WITH CHECK (bucket_id = 'materials');

CREATE POLICY "Public materials storage delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'materials');

-- 8. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
