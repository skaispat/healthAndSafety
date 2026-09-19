-- ==============================================================================
-- HEALTH & SAFETY MANAGEMENT SYSTEM - CLEAN DATABASE STATE
-- ALL MOCK AND DUMMY SEED DATA HAS BEEN WIPED OUT.
-- ==============================================================================

-- If you previously inserted test/mock data and wish to truncate the observation tables:
-- TRUNCATE TABLE public.observation_photos CASCADE;
-- TRUNCATE TABLE public.notifications CASCADE;
-- TRUNCATE TABLE public.observation_messages CASCADE;
-- TRUNCATE TABLE public.observations CASCADE;

-- System is configured to read directly from your existing:
-- 1. public.departments (dept_id, name, code, is_active)
-- 2. public.users (emp_id, full_name, username, department, role, status, dept_id)
