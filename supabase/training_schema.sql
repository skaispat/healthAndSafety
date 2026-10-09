-- ==============================================================================
-- TRAININGS TABLE (Single Table Schema)
-- Run this in your Supabase SQL Editor
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.trainings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dept_id BIGINT NOT NULL REFERENCES public.departments(dept_id),
    dept_name TEXT NULL,
    area TEXT NOT NULL,
    training_topic TEXT NOT NULL,
    description TEXT NOT NULL,
    number_of_persons INTEGER NOT NULL DEFAULT 1 CHECK (number_of_persons > 0),
    training_date DATE NOT NULL DEFAULT CURRENT_DATE,
    conducted_by BIGINT REFERENCES public.users(emp_id) ON DELETE SET NULL,
    training_photos JSONB DEFAULT '[]'::jsonb,
    attendance_photos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Simple RLS Policy
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trainings open access" ON public.trainings;
CREATE POLICY "Trainings open access" ON public.trainings FOR ALL USING (TRUE) WITH CHECK (TRUE);

GRANT ALL ON TABLE public.trainings TO anon, authenticated, service_role;

-- Storage Bucket 'observation' (used for training photos and attendance photos)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('observation', 'observation', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Observation bucket open access" ON storage.objects;
CREATE POLICY "Observation bucket open access" ON storage.objects 
FOR ALL USING (bucket_id = 'observation') 
WITH CHECK (bucket_id = 'observation');
