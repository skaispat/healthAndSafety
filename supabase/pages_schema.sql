-- ==============================================================================
-- RUN THIS SCRIPT IN YOUR SUPABASE SQL EDITOR
-- Creates the single unified table 'observations' (Observation + Task merged),
-- along with 'observation_photos' and 'notifications'.
-- All foreign keys reference your existing public.users(emp_id) and departments(dept_id).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. UNIFIED OBSERVATIONS TABLE
CREATE TABLE IF NOT EXISTS public.observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by BIGINT NOT NULL REFERENCES public.users(emp_id) ON DELETE RESTRICT,
    dept_id BIGINT NOT NULL REFERENCES public.departments(dept_id) ON DELETE RESTRICT,
    area VARCHAR(255) NOT NULL,
    observation_text TEXT NOT NULL,
    solution_text TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    risk_min NUMERIC(3, 1) NOT NULL DEFAULT 3.0,
    risk_max NUMERIC(3, 1) NOT NULL DEFAULT 6.0,
    assigned_to BIGINT NOT NULL REFERENCES public.users(emp_id) ON DELETE RESTRICT,
    due_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN (
        'OPEN', 
        'ASSIGNED', 
        'IN_PROGRESS', 
        'SUBMITTED_FOR_REVIEW', 
        'REWORK_REQUIRED', 
        'COMPLETED', 
        'OVERDUE', 
        'CLOSED'
    )),
    corrective_action TEXT,
    rework_reason TEXT,
    is_personal BOOLEAN DEFAULT FALSE NOT NULL,
    closed_by BIGINT REFERENCES public.users(emp_id) ON DELETE SET NULL,
    closed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by BIGINT REFERENCES public.users(emp_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. OBSERVATION PHOTOS TABLE
CREATE TABLE IF NOT EXISTS public.observation_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES public.observations(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    file_name VARCHAR(255),
    photo_type VARCHAR(50) NOT NULL DEFAULT 'INITIAL' CHECK (photo_type IN ('INITIAL', 'CORRECTIVE')),
    uploaded_by BIGINT REFERENCES public.users(emp_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES public.users(emp_id) ON DELETE CASCADE,
    observation_id UUID REFERENCES public.observations(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. OBSERVATION MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.observation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES public.observations(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES public.users(emp_id) ON DELETE RESTRICT,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. OBSERVATION HISTORY & REWORK TRACKING TABLE
-- Records every attempt, submission remarks, refusal/rework reasons, and approval in loop cycles
CREATE TABLE IF NOT EXISTS public.observation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES public.observations(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'CREATED', 'ASSIGNED', 'SUBMITTED_FOR_REVIEW', 'REWORK_REQUIRED', 'COMPLETED', 'CLOSED'
    attempt_number INT NOT NULL DEFAULT 1,
    description TEXT NOT NULL,
    rework_reason TEXT,
    performed_by BIGINT NOT NULL REFERENCES public.users(emp_id) ON DELETE RESTRICT,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    photos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_observations_dept ON public.observations(dept_id);
CREATE INDEX IF NOT EXISTS idx_observations_created_by ON public.observations(created_by);
CREATE INDEX IF NOT EXISTS idx_observations_assigned_to ON public.observations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_observations_status ON public.observations(status);
CREATE INDEX IF NOT EXISTS idx_observations_due_date ON public.observations(due_date);
CREATE INDEX IF NOT EXISTS idx_observation_photos_obs ON public.observation_photos(observation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_observation_messages_obs ON public.observation_messages(observation_id);
CREATE INDEX IF NOT EXISTS idx_obs_history_obs_id ON public.observation_history(observation_id);
CREATE INDEX IF NOT EXISTS idx_obs_history_performed_by ON public.observation_history(performed_by);
CREATE INDEX IF NOT EXISTS idx_obs_history_created_at ON public.observation_history(created_at);

-- 6. AUTOMATIC RISK FACTOR TRIGGER
CREATE OR REPLACE FUNCTION trg_calculate_observation_risk()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.priority = 'LOW' THEN    
        NEW.risk_min := 1.0;
        NEW.risk_max := 3.0;
    ELSIF NEW.priority = 'MEDIUM' THEN
        NEW.risk_min := 3.0;
        NEW.risk_max := 6.0;
    ELSIF NEW.priority = 'HIGH' THEN
        NEW.risk_min := 6.0;
        NEW.risk_max := 9.0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_observation_risk ON public.observations;
CREATE TRIGGER set_observation_risk
    BEFORE INSERT OR UPDATE OF priority ON public.observations
    FOR EACH ROW
    EXECUTE FUNCTION trg_calculate_observation_risk();

-- 7. AUTO-UPDATE TIMESTAMPS
CREATE OR REPLACE FUNCTION trg_update_observation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_observations_modtime ON public.observations;
CREATE TRIGGER update_observations_modtime
    BEFORE UPDATE ON public.observations
    FOR EACH ROW
    EXECUTE FUNCTION trg_update_observation_timestamp();

-- 8. ROW LEVEL SECURITY (RLS) & GRANTS
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observation_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observation_messages ENABLE ROW LEVEL SECURITY;

-- Disable RLS on observation_history or allow all roles to ensure no 42501 errors
ALTER TABLE public.observation_history DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.observation_history TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Observations open access" ON public.observations;
CREATE POLICY "Observations open access" ON public.observations FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Observation photos open access" ON public.observation_photos;
CREATE POLICY "Observation photos open access" ON public.observation_photos FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Notifications open access" ON public.notifications;
CREATE POLICY "Notifications open access" ON public.notifications FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Observation messages open access" ON public.observation_messages;
CREATE POLICY "Observation messages open access" ON public.observation_messages FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 9. HELPER ROUTINE: CHECK AND FLAG OVERDUE OBSERVATION TASKS
CREATE OR REPLACE FUNCTION public.check_and_update_overdue_tasks()
RETURNS INTEGER AS $$
DECLARE
    overdue_count INTEGER := 0;
    r RECORD;
BEGIN
    FOR r IN 
        SELECT o.id, o.created_by, u.full_name as assignee_name
        FROM public.observations o
        JOIN public.users u ON o.assigned_to = u.emp_id
        WHERE o.due_date < NOW()
          AND o.status NOT IN ('COMPLETED', 'CLOSED', 'OVERDUE')
    LOOP
        UPDATE public.observations 
        SET status = 'OVERDUE', updated_at = NOW() 
        WHERE id = r.id;

        INSERT INTO public.notifications (user_id, observation_id, notification_type, title, message)
        VALUES (
            r.created_by,
            r.id,
            'TASK_OVERDUE',
            'Overdue Safety Action',
            'Observation task assigned to ' || r.assignee_name || ' has passed its resolution due date.'
        );

        overdue_count := overdue_count + 1;
    END LOOP;
    RETURN overdue_count;
END;
$$ LANGUAGE plpgsql;

