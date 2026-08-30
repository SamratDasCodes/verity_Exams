-- ==============================================================================
-- Supabase Schema for Frictionless Single-Admin Quiz Application
-- ==============================================================================

-- 1. Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Quizzes Table
-- Stores the quiz title, creation date, and raw JSON containing the questions,
-- options, and answer keys.
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  raw_json JSONB NOT NULL,
  header_image_url TEXT,
  topic_quotas JSONB
);

-- 3. Attempts Table
-- Stores individual trainee submissions, linked by quiz_id foreign key.
CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  trainee_name TEXT NOT NULL,
  score INT NOT NULL,
  max_score INT NOT NULL DEFAULT 0,
  tab_switches INT NOT NULL DEFAULT 0,
  breakdown JSONB,
  answers JSONB,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Fast Query Indexes
CREATE INDEX IF NOT EXISTS idx_attempts_quiz_id ON attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_submitted_at ON attempts(submitted_at DESC);

-- 5. Row Level Security (RLS) Configuration
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to allow safe re-runs
DROP POLICY IF EXISTS "Allow public read access to quizzes" ON quizzes;
DROP POLICY IF EXISTS "Allow public insert to attempts" ON attempts;
DROP POLICY IF EXISTS "Allow public read to attempts" ON attempts;
DROP POLICY IF EXISTS "Allow anon insert to quizzes" ON quizzes;
DROP POLICY IF EXISTS "Allow anon update to quizzes" ON quizzes;
DROP POLICY IF EXISTS "Allow anon delete to quizzes" ON quizzes;
DROP POLICY IF EXISTS "Allow anon delete to attempts" ON attempts;

-- Allow public read access to quizzes so attendees can take them
CREATE POLICY "Allow public read access to quizzes"
  ON quizzes FOR SELECT
  USING (true);

-- Allow public insert to attempts so attendees can record their scores
CREATE POLICY "Allow public insert to attempts"
  ON attempts FOR INSERT
  WITH CHECK (true);

-- Allow public read to attempts for analytics or quiz author
CREATE POLICY "Allow public read to attempts"
  ON attempts FOR SELECT
  USING (true);

-- Allow insert/update/delete on quizzes with anon/service_role
CREATE POLICY "Allow anon insert to quizzes"
  ON quizzes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anon update to quizzes"
  ON quizzes FOR UPDATE
  USING (true);

CREATE POLICY "Allow anon delete to quizzes"
  ON quizzes FOR DELETE
  USING (true);

-- Allow delete on attempts
CREATE POLICY "Allow anon delete to attempts"
  ON attempts FOR DELETE
  USING (true);

-- ==============================================================================
-- 4. Live Student Sessions (Real-Time Proctoring / Classroom Monitor)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  trainee_name TEXT NOT NULL,
  answered_count INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  tab_switches INT NOT NULL DEFAULT 0,
  last_active TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, trainee_name)
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_quiz_id ON live_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_last_active ON live_sessions(last_active DESC);

ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to live_sessions" ON live_sessions;
DROP POLICY IF EXISTS "Allow public insert to live_sessions" ON live_sessions;
DROP POLICY IF EXISTS "Allow public update to live_sessions" ON live_sessions;
DROP POLICY IF EXISTS "Allow public delete to live_sessions" ON live_sessions;

CREATE POLICY "Allow public read access to live_sessions"
  ON live_sessions FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to live_sessions"
  ON live_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to live_sessions"
  ON live_sessions FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete to live_sessions"
  ON live_sessions FOR DELETE
  USING (true);

-- Migration helpers for existing databases:
ALTER TABLE IF EXISTS attempts ADD COLUMN IF NOT EXISTS tab_switches INT NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS live_sessions ADD COLUMN IF NOT EXISTS tab_switches INT NOT NULL DEFAULT 0;

