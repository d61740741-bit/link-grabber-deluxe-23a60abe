CREATE OR REPLACE FUNCTION public.get_character_attributes(p_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := COALESCE(p_user, auth.uid());
  v_workouts int; v_workout_min int; v_cardio int; v_health int; v_water int; v_sleep numeric;
  v_sleep_q numeric; v_mood numeric; v_books int; v_study_min int; v_missions int;
  v_missions_hard int; v_habit_streak int; v_habits int; v_focus_min int; v_focus_cnt int;
  v_journal int; v_fin int; v_balance numeric; v_goals int; v_clean_days int; v_titles int;
  v_forca int; v_agil int; v_resist int; v_disc int; v_foco int; v_intel int;
  v_caris int; v_lider int; v_riq int; v_equil int; v_vital int;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COUNT(*), COALESCE(SUM(duration_min),0),
         COUNT(*) FILTER (WHERE workout_type ILIKE '%cardio%' OR workout_type ILIKE '%corrid%' OR workout_type ILIKE '%run%' OR workout_type ILIKE '%bike%' OR workout_type ILIKE '%nata%')
    INTO v_workouts, v_workout_min, v_cardio FROM public.workouts WHERE user_id = v_uid;
  SELECT COUNT(*), COALESCE(SUM(water_ml),0), COALESCE(AVG(sleep_hours),0),
         COALESCE(AVG(sleep_quality),0), COALESCE(AVG(mood),0)
    INTO v_health, v_water, v_sleep, v_sleep_q, v_mood FROM public.health_logs WHERE user_id = v_uid;
  SELECT COUNT(*) FILTER (WHERE completed), COALESCE(SUM(study_seconds)/60,0)
    INTO v_books, v_study_min FROM public.library_items WHERE user_id = v_uid;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE difficulty IN ('dificil','epica','lendaria') OR priority IN ('alta','urgente'))
    INTO v_missions, v_missions_hard FROM public.tasks
    WHERE user_id = v_uid AND completed = true AND is_template = false;
  SELECT COUNT(*), COALESCE(MAX(best_streak),0) INTO v_habits, v_habit_streak
    FROM public.habits WHERE user_id = v_uid;
  SELECT COALESCE(SUM(actual_seconds)/60,0), COUNT(*) INTO v_focus_min, v_focus_cnt
    FROM public.focus_sessions WHERE user_id = v_uid AND completed = true;
  SELECT COUNT(*) INTO v_journal FROM public.journal_entries WHERE user_id = v_uid;
  SELECT COUNT(*), COALESCE(SUM(CASE WHEN kind='receita' THEN amount WHEN kind='despesa' THEN -amount ELSE 0 END),0)
    INTO v_fin, v_balance FROM public.finance_transactions WHERE user_id = v_uid;
  SELECT COUNT(*) INTO v_goals FROM public.goals WHERE user_id = v_uid AND completed = true;
  SELECT COALESCE(SUM(GREATEST(0, floor(EXTRACT(EPOCH FROM (now()-started_at))/86400)::int)),0)
    INTO v_clean_days FROM public.bad_habits WHERE user_id = v_uid AND archived_at IS NULL;
  SELECT COUNT(*) INTO v_titles FROM public.user_titles WHERE user_id = v_uid;

  v_forca  := v_workouts * 12 + (v_workout_min / 10);
  v_agil   := v_cardio * 18 + (v_workout_min / 20) + v_habits * 3;
  v_resist := (v_workout_min / 6) + v_clean_days * 3 + v_habit_streak * 4;
  v_disc   := v_missions * 4 + v_habit_streak * 6 + (v_focus_min / 8) + v_clean_days * 2;
  v_foco   := (v_focus_min / 4) + v_focus_cnt * 6 + (v_study_min / 10);
  v_intel  := v_books * 40 + (v_study_min / 5);
  v_caris  := v_journal * 8 + v_habits * 4;
  v_lider  := v_goals * 25 + v_missions_hard * 8 + v_titles * 10;
  v_riq    := v_fin * 5 + GREATEST(0, floor(v_balance / 50))::int;
  v_equil  := v_journal * 6 + round(v_mood * 12)::int + round(v_sleep_q * 10)::int + (CASE WHEN v_sleep BETWEEN 7 AND 9 THEN 30 ELSE 0 END);
  v_vital  := v_health * 6 + (v_water / 500) + (CASE WHEN v_sleep BETWEEN 7 AND 9 THEN 40 ELSE 0 END);

  RETURN jsonb_build_array(
    jsonb_build_object('key','forca','label','Força','icon','⚔️','points',v_forca,'level',GREATEST(1, floor(sqrt(v_forca/20.0))::int + 1)),
    jsonb_build_object('key','agilidade','label','Agilidade','icon','🏃','points',v_agil,'level',GREATEST(1, floor(sqrt(v_agil/20.0))::int + 1)),
    jsonb_build_object('key','resistencia','label','Resistência','icon','🛡️','points',v_resist,'level',GREATEST(1, floor(sqrt(v_resist/20.0))::int + 1)),
    jsonb_build_object('key','disciplina','label','Disciplina','icon','⚡','points',v_disc,'level',GREATEST(1, floor(sqrt(v_disc/20.0))::int + 1)),
    jsonb_build_object('key','foco','label','Foco','icon','🎯','points',v_foco,'level',GREATEST(1, floor(sqrt(v_foco/20.0))::int + 1)),
    jsonb_build_object('key','intelecto','label','Conhecimento','icon','🧠','points',v_intel,'level',GREATEST(1, floor(sqrt(v_intel/20.0))::int + 1)),
    jsonb_build_object('key','carisma','label','Comunicação','icon','🤝','points',v_caris,'level',GREATEST(1, floor(sqrt(v_caris/20.0))::int + 1)),
    jsonb_build_object('key','lideranca','label','Liderança','icon','🦅','points',v_lider,'level',GREATEST(1, floor(sqrt(v_lider/20.0))::int + 1)),
    jsonb_build_object('key','riqueza','label','Gestão Financeira','icon','💎','points',v_riq,'level',GREATEST(1, floor(sqrt(v_riq/20.0))::int + 1)),
    jsonb_build_object('key','equilibrio','label','Equilíbrio Mental','icon','🌙','points',v_equil,'level',GREATEST(1, floor(sqrt(v_equil/20.0))::int + 1)),
    jsonb_build_object('key','vitalidade','label','Vitalidade','icon','❤️','points',v_vital,'level',GREATEST(1, floor(sqrt(v_vital/20.0))::int + 1))
  );
END $function$;

INSERT INTO public.shop_items (key, name, description, icon, kind, rarity, price, required_level, metadata, active, sort_order) VALUES
  ('relic_chronos','Relíquia de Chronos','O tempo obedece a quem domina o foco.','⌛','artifact','mythic',3000,25,'{"relic":true,"passive":"Foco Absoluto"}'::jsonb,true,200),
  ('relic_atlas','Relíquia de Atlas','Peso nenhum quebra quem já carregou tudo.','🗿','artifact','legendary',1800,18,'{"relic":true,"passive":"Corpo Resistente"}'::jsonb,true,201),
  ('relic_oraculo','Relíquia do Oráculo','Conhecimento que atravessa eras.','🔮','artifact','legendary',1500,15,'{"relic":true,"passive":"Aprendizado Rápido"}'::jsonb,true,202),
  ('relic_vault','Relíquia do Cofre Eterno','A riqueza serve quem a controla.','🏛️','artifact','epic',900,10,'{"relic":true,"passive":"Mente Estratégica"}'::jsonb,true,203),
  ('relic_phoenix','Relíquia da Fênix','Renasce toda vez que recomeça.','🕊️','artifact','mythic',4000,30,'{"relic":true,"passive":"Disciplina Inabalável"}'::jsonb,true,204),
  ('box_comum','Caixa do Sistema','Um artefato menor selado pelo Sistema.','📦','artifact','common',120,1,'{"box":true}'::jsonb,true,210),
  ('boost_xp','Núcleo de Ímpeto','Marca de quem acelerou a própria evolução.','🔆','boost','rare',400,6,'{"boost":true}'::jsonb,true,211),
  ('cosmetic_aura','Aura do Observado','Um brilho que só os observados possuem.','🌌','cosmetic','epic',750,12,'{"cosmetic":true}'::jsonb,true,212)
ON CONFLICT (key) DO NOTHING;