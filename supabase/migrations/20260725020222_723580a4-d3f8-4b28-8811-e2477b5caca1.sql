
CREATE OR REPLACE FUNCTION public.run_xp_tests()
RETURNS TABLE(test_name text, passed boolean, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := gen_random_uuid();
  v_xp int;
  v_prev int;
  v_task_id uuid;
  v_habit_id uuid;
  v_workout_id uuid;
  v_finance_id uuid;
  v_journal_id uuid;
  v_library_id uuid;
  v_focus_id uuid;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'xptest_' || v_uid::text || '@test.local', '', now(), now(), now());

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
    INSERT INTO public.profiles(id, username) VALUES (v_uid, 'xptest');
    INSERT INTO public.skills(user_id, category)
      SELECT v_uid, c FROM unnest(ARRAY['mente','corpo','conhecimento','financas','disciplina','social']::skill_category[]) c;
  END IF;

  PERFORM public.recalculate_xp(v_uid);
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='inicial: XP = 0'; passed:=(v_xp=0); detail:='xp='||v_xp; RETURN NEXT;

  -- TASK create
  SELECT COALESCE(total_xp,0) INTO v_prev FROM public.profiles WHERE id=v_uid;
  INSERT INTO public.tasks(user_id, title, xp_reward, completed, completed_at, skill_category)
    VALUES (v_uid,'t',20,true,now(),'mente') RETURNING id INTO v_task_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='task criada aumenta XP'; passed:=(v_xp>v_prev); detail:='xp='||v_xp||' prev='||v_prev; RETURN NEXT;

  -- TASK edit
  v_prev := v_xp;
  UPDATE public.tasks SET xp_reward=100 WHERE id=v_task_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='task editada aumenta XP'; passed:=(v_xp>v_prev); detail:='xp='||v_xp||' prev='||v_prev; RETURN NEXT;

  -- TASK delete
  DELETE FROM public.tasks WHERE id=v_task_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='task excluida zera XP'; passed:=(v_xp=0); detail:='xp='||v_xp; RETURN NEXT;

  -- HABIT
  INSERT INTO public.habits(user_id,title,xp_reward,streak,best_streak,last_completed_date,skill_category)
    VALUES (v_uid,'h',10,3,3,CURRENT_DATE,'disciplina') RETURNING id INTO v_habit_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='habit criado aumenta XP'; passed:=(v_xp>0); detail:='xp='||v_xp; RETURN NEXT;

  DELETE FROM public.habits WHERE id=v_habit_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='habit excluido zera XP'; passed:=(v_xp=0); detail:='xp='||v_xp; RETURN NEXT;

  -- WORKOUT
  INSERT INTO public.workouts(user_id,workout_type,duration_min,performed_at)
    VALUES (v_uid,'corrida',30,now()) RETURNING id INTO v_workout_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='workout criado aumenta XP'; passed:=(v_xp>0); detail:='xp='||v_xp; RETURN NEXT;

  v_prev:=v_xp;
  UPDATE public.workouts SET duration_min=60 WHERE id=v_workout_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='workout editado altera XP'; passed:=(v_xp<>v_prev); detail:='xp='||v_xp||' prev='||v_prev; RETURN NEXT;

  DELETE FROM public.workouts WHERE id=v_workout_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='workout excluido zera XP'; passed:=(v_xp=0); detail:='xp='||v_xp; RETURN NEXT;

  -- FINANCE
  INSERT INTO public.finance_transactions(user_id,kind,amount,occurred_on)
    VALUES (v_uid,'receita',100,CURRENT_DATE) RETURNING id INTO v_finance_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='finance criada da 10 XP'; passed:=(v_xp=10); detail:='xp='||v_xp; RETURN NEXT;

  DELETE FROM public.finance_transactions WHERE id=v_finance_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='finance excluida zera XP'; passed:=(v_xp=0); detail:='xp='||v_xp; RETURN NEXT;

  -- JOURNAL
  INSERT INTO public.journal_entries(user_id,thoughts) VALUES (v_uid,'t') RETURNING id INTO v_journal_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='journal criado da 15 XP'; passed:=(v_xp=15); detail:='xp='||v_xp; RETURN NEXT;

  DELETE FROM public.journal_entries WHERE id=v_journal_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='journal excluido zera XP'; passed:=(v_xp=0); detail:='xp='||v_xp; RETURN NEXT;

  -- LIBRARY livro
  INSERT INTO public.library_items(user_id,title,item_type,completed)
    VALUES (v_uid,'livro','livro',true) RETURNING id INTO v_library_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='library livro completo da 50 XP'; passed:=(v_xp=50); detail:='xp='||v_xp; RETURN NEXT;

  UPDATE public.library_items SET completed=false WHERE id=v_library_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='library uncompleted zera XP'; passed:=(v_xp=0); detail:='xp='||v_xp; RETURN NEXT;

  DELETE FROM public.library_items WHERE id=v_library_id;

  -- FOCUS
  INSERT INTO public.focus_sessions(user_id,planned_seconds,actual_seconds,completed,started_at,ended_at)
    VALUES (v_uid,600,600,true,now(),now()) RETURNING id INTO v_focus_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='focus completo aumenta XP'; passed:=(v_xp>0); detail:='xp='||v_xp; RETURN NEXT;

  DELETE FROM public.focus_sessions WHERE id=v_focus_id;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='focus excluido zera XP'; passed:=(v_xp=0); detail:='xp='||v_xp; RETURN NEXT;

  -- MULTI-FONTE
  INSERT INTO public.tasks(user_id,title,xp_reward,completed,completed_at) VALUES (v_uid,'t',30,true,now());
  INSERT INTO public.workouts(user_id,workout_type,duration_min,performed_at) VALUES (v_uid,'t',30,now());
  INSERT INTO public.finance_transactions(user_id,kind,amount,occurred_on) VALUES (v_uid,'despesa',50,CURRENT_DATE);
  INSERT INTO public.journal_entries(user_id,thoughts) VALUES (v_uid,'t');
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='multi-fonte acumula XP'; passed:=(v_xp>0); detail:='xp='||v_xp; RETURN NEXT;

  DELETE FROM public.tasks WHERE user_id=v_uid;
  DELETE FROM public.workouts WHERE user_id=v_uid;
  DELETE FROM public.finance_transactions WHERE user_id=v_uid;
  DELETE FROM public.journal_entries WHERE user_id=v_uid;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id=v_uid;
  test_name:='apagar tudo -> XP = 0'; passed:=(v_xp=0); detail:='xp='||v_xp; RETURN NEXT;

  DELETE FROM auth.users WHERE id=v_uid;
  RETURN;
EXCEPTION WHEN OTHERS THEN
  BEGIN DELETE FROM auth.users WHERE id=v_uid; EXCEPTION WHEN OTHERS THEN NULL; END;
  test_name:='exception'; passed:=false; detail:=SQLERRM; RETURN NEXT;
  RETURN;
END;
$fn$;

REVOKE ALL ON FUNCTION public.run_xp_tests() FROM PUBLIC;
