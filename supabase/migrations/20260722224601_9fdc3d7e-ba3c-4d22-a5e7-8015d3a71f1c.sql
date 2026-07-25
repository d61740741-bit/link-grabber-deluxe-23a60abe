-- Migration 1
-- ENUMs
CREATE TYPE public.skill_category AS ENUM ('mente','corpo','conhecimento','financas','disciplina','social');
CREATE TYPE public.task_category AS ENUM ('estudo','treino','leitura','meditacao','nutricao','financas','habito','outro');
CREATE TYPE public.transaction_kind AS ENUM ('receita','despesa');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT, full_name TEXT, avatar_url TEXT, bio TEXT,
  level INT NOT NULL DEFAULT 1, xp INT NOT NULL DEFAULT 0,
  total_xp INT NOT NULL DEFAULT 0, streak_days INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);