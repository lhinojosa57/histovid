-- HistoVid Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (linked to auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')) DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Teachers can view student profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE g.teacher_id = auth.uid() AND gm.student_id = profiles.id
    )
  );

-- ============================================================
-- GROUPS
-- ============================================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT DEFAULT 'Historia',
  grade TEXT,
  school_year TEXT,
  invite_code TEXT UNIQUE DEFAULT UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own groups" ON groups
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Students can view enrolled groups" ON groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members WHERE group_id = groups.id AND student_id = auth.uid()
    )
  );

-- ============================================================
-- GROUP MEMBERS
-- ============================================================
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, student_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage group members" ON group_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM groups WHERE id = group_members.group_id AND teacher_id = auth.uid())
  );

CREATE POLICY "Students view own memberships" ON group_members
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students can join groups" ON group_members
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- ============================================================
-- VIDEO ASSIGNMENTS
-- ============================================================
CREATE TABLE video_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,                    -- Tema del día
  objective TEXT,                          -- Objetivo de aprendizaje
  nem_process TEXT,                        -- Proceso NEM (opcional)
  video_url TEXT NOT NULL,
  video_duration_seconds INTEGER,
  due_date TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE video_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own assignments" ON video_assignments
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Students view published assignments in enrolled groups" ON video_assignments
  FOR SELECT USING (
    is_published = TRUE AND
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = video_assignments.group_id AND student_id = auth.uid()
    )
  );

-- ============================================================
-- QUESTIONS
-- ============================================================
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES video_assignments(id) ON DELETE CASCADE,
  timestamp_seconds FLOAT NOT NULL,       -- At what second to pause video
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'open')),
  question_text TEXT NOT NULL,
  options JSONB,                           -- For multiple_choice: [{id, text}]
  correct_answer TEXT,                     -- For multiple_choice/true_false
  points INTEGER DEFAULT 10,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage questions of own assignments" ON questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM video_assignments WHERE id = questions.assignment_id AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students view questions of enrolled assignments" ON questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM video_assignments va
      JOIN group_members gm ON gm.group_id = va.group_id
      WHERE va.id = questions.assignment_id AND gm.student_id = auth.uid() AND va.is_published = TRUE
    )
  );

-- ============================================================
-- STUDENT SESSIONS (tracks entire activity session)
-- ============================================================
CREATE TABLE student_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES video_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  score NUMERIC(5,2) DEFAULT 0,           -- 0-100
  max_video_position FLOAT DEFAULT 0,     -- furthest second watched
  is_completed BOOLEAN DEFAULT FALSE,
  UNIQUE(assignment_id, student_id)
);

ALTER TABLE student_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own sessions" ON student_sessions
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers view sessions in own assignments" ON student_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM video_assignments
      WHERE id = student_sessions.assignment_id AND teacher_id = auth.uid()
    )
  );

-- ============================================================
-- STUDENT ANSWERS
-- ============================================================
CREATE TABLE student_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES student_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answer_text TEXT,
  is_correct BOOLEAN,                      -- NULL for open questions
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, question_id)
);

ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own answers" ON student_answers
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Teachers view answers in own assignments" ON student_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM student_sessions ss
      JOIN video_assignments va ON va.id = ss.assignment_id
      WHERE ss.id = student_answers.session_id AND va.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON video_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Compute score after answer insert
CREATE OR REPLACE FUNCTION recalculate_session_score()
RETURNS TRIGGER AS $$
DECLARE
  v_total_points INTEGER;
  v_earned_points INTEGER;
  v_score NUMERIC;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO v_total_points
  FROM questions WHERE assignment_id = (
    SELECT assignment_id FROM student_sessions WHERE id = NEW.session_id
  );

  SELECT COALESCE(SUM(points_earned), 0) INTO v_earned_points
  FROM student_answers WHERE session_id = NEW.session_id;

  IF v_total_points > 0 THEN
    v_score := ROUND((v_earned_points::NUMERIC / v_total_points::NUMERIC) * 100, 2);
  ELSE
    v_score := 100;
  END IF;

  UPDATE student_sessions SET score = v_score WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_answer_insert
  AFTER INSERT OR UPDATE ON student_answers
  FOR EACH ROW EXECUTE FUNCTION recalculate_session_score();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_group_members_student ON group_members(student_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_assignments_group ON video_assignments(group_id);
CREATE INDEX idx_assignments_teacher ON video_assignments(teacher_id);
CREATE INDEX idx_questions_assignment ON questions(assignment_id);
CREATE INDEX idx_sessions_assignment ON student_sessions(assignment_id);
CREATE INDEX idx_sessions_student ON student_sessions(student_id);
CREATE INDEX idx_answers_session ON student_answers(session_id);
