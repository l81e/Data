-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name_en text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  email text NOT NULL UNIQUE,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.lectures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  date date NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#7aaee8'::text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  year_of_view USER-DEFINED NOT NULL DEFAULT 'first year'::year_of_view,
  CONSTRAINT lectures_pkey PRIMARY KEY (id),
  CONSTRAINT lectures_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lecture_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['pdf'::text, 'q'::text, 'spotify'::text, 'youtube'::text])),
  kind text NOT NULL CHECK (kind = ANY (ARRAY['link'::text, 'upload'::text])),
  title text NOT NULL,
  url text,
  file_name text,
  caption text,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT materials_pkey PRIMARY KEY (id),
  CONSTRAINT materials_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES public.lectures(id),
  CONSTRAINT materials_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id)
);