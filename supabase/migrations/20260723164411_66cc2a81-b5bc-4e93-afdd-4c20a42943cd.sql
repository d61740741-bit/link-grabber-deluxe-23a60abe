-- =====================================================================
-- REFATORAÇÃO COMPLETA DO SISTEMA DE XP
-- Fonte única de verdade: public.xp_history
-- Nenhum módulo altera XP/nível/rank manualmente. Tudo derivado.
-- =====================================================================

-- 1) source_key: chave única por lançamento (impede duplicação e permite estorno)
ALTER TABLE public.xp_history
  ADD COLUMN IF NOT EXISTS source_key text;

CREATE UNIQUE INDEX IF NOT EXISTS xp_history_user_source_key_uniq
  ON public.xp_history(user_id, source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS xp_history_user_created_idx
  ON public.xp_history(user_id, created_at);

-- Backfill: reaproveita "source" quando já vem no formato "tipo:id[:...]"
UPDATE public.xp_history
  SET source_key = source
  WHERE source_key IS NULL AND source LIKE '%:%';

-- =====================================================================
-- 2) RECALCULAR XP — função global, única, autoritativa
-- =====================================================================
CREATE OR REPLACE FUNCTION public.recalc_xp(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total int;
  v_level int;
  v_last  date;
  v_streak int := 0;
  v_cursor date;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  -- XP total (somente positivos + negativos do próprio ledger)
  SELECT COALESCE(SUM(amount),0)::int INTO v_total
    FROM public.xp_history WHERE user_id = p_user_id;
  v_total := GREATEST(0, v_total);
  v_level := GREATEST(1, floor(sqrt(v_total / 50.0))::int + 1);

  -- Streak diária: sequência de dias consecutivos com XP > 0 até hoje/ontem
  SELECT max(date(created_at)) INTO v_last
    FROM public.xp_history WHERE user_id = p_user_id AND amount > 0;

  IF v_last IS NOT NULL AND v_last >= CURRENT_DATE - 1 THEN
    v_cursor := v_last;
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.xp_history
         WHERE user_id = p_user_id AND amount > 0
           AND date(created_at) = v_cursor
      ) THEN
        v_streak := v_streak + 1;
        v_cursor := v_cursor - 1;
      ELSE EXIT;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.profiles
     SET total_xp        = v_total,
         xp              = v_total,
         level           = v_level,
         streak_days     = v_streak,
         last_active_date= v_last,
         updated_at      = now()
   WHERE id = p_user_id;

  -- Skills padrão (por categoria)
  UPDATE public.skills s
     SET total_xp = agg.tot,
         xp       = agg.tot,
         level    = GREATEST(1, floor(sqrt(GREATEST(0,agg.tot) / 30.0))::int + 1)
    FROM (
      SELECT skill_category AS cat, COALESCE(SUM(amount),0)::int AS tot
        FROM public.xp_history
       WHERE user_id = p_user_id AND skill_category IS NOT NULL
       GROUP BY skill_category
    ) agg
   WHERE s.user_id = p_user_id AND s.category = agg.cat;

  -- Skills customizadas (por id)
  UPDATE public.skills s
     SET total_xp = agg.tot,
         xp       = agg.tot,
         level    = GREATEST(1, floor(sqrt(GREATEST(0,agg.tot) / 30.0))::int + 1)
    FROM (
      SELECT custom_skill_id AS sid, COALESCE(SUM(amount),0)::int AS tot
        FROM public.xp_history
       WHERE user_id = p_user_id AND custom_skill_id IS NOT NULL
       GROUP BY custom_skill_id
    ) agg
   WHERE s.id = agg.sid AND s.user_id = p_user_id;

  -- Skills sem nenhum registro no ledger voltam a zero
  UPDATE public.skills
     SET total_xp = 0, xp = 0, level = 1
   WHERE user_id = p_user_id
     AND NOT EXISTS (
       SELECT 1 FROM public.xp_history h
        WHERE h.user_id = p_user_id
          AND (h.skill_category = skills.category
               OR h.custom_skill_id = skills.id)
     );

  -- Derivados: rank, títulos, life score (nunca falhar recalc por causa deles)
  BEGIN PERFORM public.check_rank(p_user_id);        EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM public.check_all_titles(p_user_id);  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM public.calc_life_score(p_user_id);   EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

REVOKE ALL ON FUNCTION public.recalc_xp(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_xp(uuid) TO service_role;

-- Versão pública sem argumentos (recalcula para o próprio usuário)
CREATE OR REPLACE FUNCTION public.recalc_xp()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.recalc_xp(v_uid);
END $$;

GRANT EXECUTE ON FUNCTION public.recalc_xp() TO authenticated;

-- =====================================================================
-- 3) Trigger no xp_history: qualquer INSERT/UPDATE/DELETE recalcula tudo
-- =====================================================================
CREATE OR REPLACE FUNCTION public.xp_history_recalc_trg()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_xp(COALESCE(NEW.user_id, OLD.user_id));
  RETURN NULL;
END $$;

-- Remove triggers antigos que faziam contabilidade manual
DROP TRIGGER IF EXISTS xp_history_after_insert         ON public.xp_history;
DROP TRIGGER IF EXISTS trg_xp_history_after_insert     ON public.xp_history;
DROP TRIGGER IF EXISTS trg_xp_history_recalc           ON public.xp_history;

CREATE TRIGGER trg_xp_history_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.xp_history
  FOR EACH ROW EXECUTE FUNCTION public.xp_history_recalc_trg();

-- =====================================================================
-- 4) _award_xp_for_user: só grava no ledger (idempotente por source_key)
--    Nunca mais toca profile/skills diretamente.
-- =====================================================================
CREATE OR REPLACE FUNCTION public._award_xp_for_user(
  p_user_id uuid,
  p_amount integer,
  p_source text,
  p_skill skill_category DEFAULT NULL,
  p_custom_skill_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_key text;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount = 0 THEN RETURN; END IF;
  -- Se p_source já parece uma chave única ("tipo:id[:...]"), usa como source_key
  v_key := CASE WHEN p_source LIKE '%:%' THEN p_source ELSE NULL END;

  IF v_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.xp_history
     WHERE user_id = p_user_id AND source_key = v_key
  ) THEN
    RETURN; -- já lançado, evita duplicação
  END IF;

  INSERT INTO public.xp_history (user_id, amount, source, source_key, skill_category, custom_skill_id)
  VALUES (p_user_id, p_amount, p_source, v_key, p_skill, p_custom_skill_id);
END $$;

-- _refund_xp_for_user: em vez de decrementar acumuladores, estorna o lançamento
CREATE OR REPLACE FUNCTION public._refund_xp_for_user(
  p_user_id uuid,
  p_amount integer,
  p_skill skill_category DEFAULT NULL,
  p_custom_skill_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- No-op: o estorno agora é feito removendo o lançamento pelo source_key
  -- nos triggers de exclusão de cada domínio (tasks, focus_sessions, etc).
  RETURN;
END $$;

-- =====================================================================
-- 5) TASKS: award idempotente + estorno por DELETE do lançamento
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tasks_after_award()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_final int;
  v_key   text;
  v_pd    text;
BEGIN
  IF NEW.xp_awarded = true AND COALESCE(OLD.xp_awarded, false) = false THEN
    v_final := public._compute_task_xp(NEW.user_id, NEW.xp_reward, NEW.completed_at);
    v_key := 'task:'||NEW.id::text;

    IF NOT EXISTS (
      SELECT 1 FROM public.xp_history
       WHERE user_id = NEW.user_id AND source_key = v_key
    ) THEN
      INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, custom_skill_id)
      VALUES (NEW.user_id, v_final, 'task', v_key, NEW.skill_category, NEW.custom_skill_id);
    END IF;

    UPDATE public.tasks SET xp_granted = v_final WHERE id = NEW.id;

    -- Perfect day (idempotente pelo source_key com a data)
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
       WHERE user_id = NEW.user_id AND completed = false AND due_date = CURRENT_DATE
    ) THEN
      v_pd := 'perfect_day:'||CURRENT_DATE::text;
      IF NOT EXISTS (
        SELECT 1 FROM public.xp_history
         WHERE user_id = NEW.user_id AND source_key = v_pd
      ) THEN
        INSERT INTO public.xp_history(user_id, amount, source, source_key)
        VALUES (NEW.user_id, 25, 'perfect_day', v_pd);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Mesma lógica no INSERT já-completo
CREATE OR REPLACE FUNCTION public.tasks_after_insert_award()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_final int;
  v_key   text;
  v_pd    text;
BEGIN
  IF NEW.xp_awarded = true THEN
    v_final := public._compute_task_xp(NEW.user_id, NEW.xp_reward, NEW.completed_at);
    v_key := 'task:'||NEW.id::text;

    IF NOT EXISTS (
      SELECT 1 FROM public.xp_history
       WHERE user_id = NEW.user_id AND source_key = v_key
    ) THEN
      INSERT INTO public.xp_history(user_id, amount, source, source_key, skill_category, custom_skill_id)
      VALUES (NEW.user_id, v_final, 'task', v_key, NEW.skill_category, NEW.custom_skill_id);
    END IF;

    UPDATE public.tasks SET xp_granted = v_final WHERE id = NEW.id;

    IF NOT EXISTS (
      SELECT 1 FROM public.tasks
       WHERE user_id = NEW.user_id AND completed = false AND due_date = CURRENT_DATE
    ) THEN
      v_pd := 'perfect_day:'||CURRENT_DATE::text;
      IF NOT EXISTS (
        SELECT 1 FROM public.xp_history
         WHERE user_id = NEW.user_id AND source_key = v_pd
      ) THEN
        INSERT INTO public.xp_history(user_id, amount, source, source_key)
        VALUES (NEW.user_id, 25, 'perfect_day', v_pd);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- DELETE de task: apaga o lançamento correspondente do ledger
CREATE OR REPLACE FUNCTION public.tasks_before_delete_refund()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.xp_history
    WHERE user_id = OLD.user_id AND source_key = 'task:'||OLD.id::text;
  RETURN OLD;
END $$;

-- UPDATE: quando task volta a "não concluída", também estorna
CREATE OR REPLACE FUNCTION public.tasks_after_uncomplete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.xp_awarded, false) = true AND COALESCE(NEW.xp_awarded, false) = false THEN
    DELETE FROM public.xp_history
      WHERE user_id = NEW.user_id AND source_key = 'task:'||NEW.id::text;
    UPDATE public.tasks SET xp_granted = 0 WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tasks_after_uncomplete ON public.tasks;
CREATE TRIGGER trg_tasks_after_uncomplete
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_after_uncomplete();

-- =====================================================================
-- 6) FOCUS SESSIONS: idempotente + estorno em DELETE
-- =====================================================================
CREATE OR REPLACE FUNCTION public.complete_focus_session(p_id uuid, p_actual_seconds integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_session public.focus_sessions;
  v_xp int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_session FROM public.focus_sessions WHERE id = p_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;
  IF v_session.completed THEN RETURN v_session.xp_awarded; END IF;

  v_xp := GREATEST(5, floor(p_actual_seconds / 60.0)::int);
  UPDATE public.focus_sessions SET
    actual_seconds = p_actual_seconds,
    completed = true,
    ended_at = now(),
    xp_awarded = v_xp
    WHERE id = p_id;

  PERFORM public._award_xp_for_user(
    v_uid, v_xp, 'focus:'||p_id::text,
    COALESCE(v_session.skill_category, 'disciplina'::public.skill_category), NULL);
  RETURN v_xp;
END $$;

CREATE OR REPLACE FUNCTION public.focus_sessions_before_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  DELETE FROM public.xp_history
    WHERE user_id = OLD.user_id AND source_key = 'focus:'||OLD.id::text;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_focus_sessions_before_delete ON public.focus_sessions;
CREATE TRIGGER trg_focus_sessions_before_delete
  BEFORE DELETE ON public.focus_sessions
  FOR EACH ROW EXECUTE FUNCTION public.focus_sessions_before_delete();

-- =====================================================================
-- 7) HÁBITOS: source_key único por dia
-- =====================================================================
CREATE OR REPLACE FUNCTION public.complete_habit_today(p_habit_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_habit public.habits;
  v_new_streak int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_habit FROM public.habits WHERE id = p_habit_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'habit not found'; END IF;
  IF v_habit.last_completed_date = CURRENT_DATE THEN RETURN; END IF;

  IF v_habit.last_completed_date = CURRENT_DATE - 1 THEN
    v_new_streak := v_habit.streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  UPDATE public.habits
     SET streak = v_new_streak,
         best_streak = GREATEST(best_streak, v_new_streak),
         last_completed_date = CURRENT_DATE
   WHERE id = p_habit_id;

  PERFORM public._award_xp_for_user(
    v_uid, v_habit.xp_reward,
    'habit:'||p_habit_id::text||':'||CURRENT_DATE::text,
    v_habit.skill_category);
END $$;

CREATE OR REPLACE FUNCTION public.habits_before_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  DELETE FROM public.xp_history
    WHERE user_id = OLD.user_id
      AND source_key LIKE 'habit:'||OLD.id::text||':%';
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_habits_before_delete ON public.habits;
CREATE TRIGGER trg_habits_before_delete
  BEFORE DELETE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.habits_before_delete();

-- =====================================================================
-- 8) BACKFILL FINAL: recalcula tudo para todos os usuários existentes
-- =====================================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.recalc_xp(r.id);
  END LOOP;
END $$;