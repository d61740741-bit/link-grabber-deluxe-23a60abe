
-- ============ PROFILE EXTENSIONS ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS class_key text,
  ADD COLUMN IF NOT EXISTS class_chosen_at timestamptz;

-- ============ CLASSES CATALOG ============
CREATE TABLE IF NOT EXISTS public.character_classes (
  key text PRIMARY KEY,
  name text NOT NULL,
  tagline text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL DEFAULT 'electric',
  primary_attr text NOT NULL,
  secondary_attr text,
  requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  perks jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.character_classes TO anon, authenticated;
GRANT ALL ON public.character_classes TO service_role;
ALTER TABLE public.character_classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "classes readable" ON public.character_classes;
CREATE POLICY "classes readable" ON public.character_classes FOR SELECT USING (true);

-- ============ SHOP CATALOG ============
CREATE TABLE IF NOT EXISTS public.shop_items (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT '📦',
  kind public.item_kind NOT NULL DEFAULT 'artifact',
  rarity public.item_rarity NOT NULL DEFAULT 'common',
  price int NOT NULL CHECK (price >= 0),
  required_level int NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_items TO anon, authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop readable" ON public.shop_items;
CREATE POLICY "shop readable" ON public.shop_items FOR SELECT USING (active);

-- ============ PURCHASES ============
CREATE TABLE IF NOT EXISTS public.shop_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL REFERENCES public.shop_items(key) ON DELETE CASCADE,
  price int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);
GRANT SELECT, INSERT, DELETE ON public.shop_purchases TO authenticated;
GRANT ALL ON public.shop_purchases TO service_role;
ALTER TABLE public.shop_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own purchases" ON public.shop_purchases;
CREATE POLICY "own purchases" ON public.shop_purchases FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ ATTRIBUTES ============
CREATE OR REPLACE FUNCTION public.get_character_attributes(p_user uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := COALESCE(p_user, auth.uid());
  v_workouts int; v_workout_min int; v_health int; v_water int; v_sleep numeric;
  v_books int; v_study_min int; v_missions int; v_habit_streak int; v_habits int;
  v_focus_min int; v_journal int; v_fin int; v_balance numeric; v_clean_days int;
  v_forca int; v_vital int; v_intel int; v_disc int; v_caris int; v_riq int;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COUNT(*), COALESCE(SUM(duration_min),0) INTO v_workouts, v_workout_min
    FROM public.workouts WHERE user_id = v_uid;
  SELECT COUNT(*), COALESCE(SUM(water_ml),0), COALESCE(AVG(sleep_hours),0)
    INTO v_health, v_water, v_sleep FROM public.health_logs WHERE user_id = v_uid;
  SELECT COUNT(*) FILTER (WHERE completed), COALESCE(SUM(study_seconds)/60,0)
    INTO v_books, v_study_min FROM public.library_items WHERE user_id = v_uid;
  SELECT COUNT(*) INTO v_missions FROM public.tasks
    WHERE user_id = v_uid AND completed = true AND is_template = false;
  SELECT COUNT(*), COALESCE(MAX(best_streak),0) INTO v_habits, v_habit_streak
    FROM public.habits WHERE user_id = v_uid;
  SELECT COALESCE(SUM(actual_seconds)/60,0) INTO v_focus_min FROM public.focus_sessions
    WHERE user_id = v_uid AND completed = true;
  SELECT COUNT(*) INTO v_journal FROM public.journal_entries WHERE user_id = v_uid;
  SELECT COUNT(*), COALESCE(SUM(CASE WHEN kind='receita' THEN amount WHEN kind='despesa' THEN -amount ELSE 0 END),0)
    INTO v_fin, v_balance FROM public.finance_transactions WHERE user_id = v_uid;
  SELECT COALESCE(SUM(GREATEST(0, floor(EXTRACT(EPOCH FROM (now()-started_at))/86400)::int)),0)
    INTO v_clean_days FROM public.bad_habits WHERE user_id = v_uid AND archived_at IS NULL;

  v_forca := v_workouts * 12 + (v_workout_min / 10);
  v_vital := v_health * 6 + (v_water / 500) + (CASE WHEN v_sleep BETWEEN 7 AND 9 THEN 40 ELSE 0 END);
  v_intel := v_books * 40 + (v_study_min / 5);
  v_disc  := v_missions * 4 + v_habit_streak * 6 + (v_focus_min / 8) + v_clean_days * 2;
  v_caris := v_journal * 8 + v_habits * 4;
  v_riq   := v_fin * 5 + GREATEST(0, floor(v_balance / 50))::int;

  RETURN jsonb_build_array(
    jsonb_build_object('key','forca','label','Força','icon','⚔️','points',v_forca,'level',GREATEST(1, floor(sqrt(v_forca/20.0))::int + 1)),
    jsonb_build_object('key','vitalidade','label','Vitalidade','icon','❤️','points',v_vital,'level',GREATEST(1, floor(sqrt(v_vital/20.0))::int + 1)),
    jsonb_build_object('key','intelecto','label','Intelecto','icon','🧠','points',v_intel,'level',GREATEST(1, floor(sqrt(v_intel/20.0))::int + 1)),
    jsonb_build_object('key','disciplina','label','Disciplina','icon','⚡','points',v_disc,'level',GREATEST(1, floor(sqrt(v_disc/20.0))::int + 1)),
    jsonb_build_object('key','carisma','label','Carisma','icon','🤝','points',v_caris,'level',GREATEST(1, floor(sqrt(v_caris/20.0))::int + 1)),
    jsonb_build_object('key','riqueza','label','Riqueza','icon','💎','points',v_riq,'level',GREATEST(1, floor(sqrt(v_riq/20.0))::int + 1))
  );
END $$;

-- ============ COINS ============
CREATE OR REPLACE FUNCTION public.get_coin_balance(p_user uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := COALESCE(p_user, auth.uid());
  v_xp int; v_achv int; v_boss int; v_spent int; v_earned int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('balance',0,'earned',0,'spent',0); END IF;
  SELECT COALESCE(total_xp,0) INTO v_xp FROM public.profiles WHERE id = v_uid;
  SELECT COUNT(*) INTO v_achv FROM public.achievements WHERE user_id = v_uid;
  SELECT COUNT(*) INTO v_boss FROM public.weekly_bosses WHERE user_id = v_uid AND status = 'completed';
  SELECT COALESCE(SUM(price),0) INTO v_spent FROM public.shop_purchases WHERE user_id = v_uid;
  v_earned := floor(COALESCE(v_xp,0) / 10.0)::int + v_achv * 15 + v_boss * 100;
  RETURN jsonb_build_object('balance', GREATEST(0, v_earned - v_spent), 'earned', v_earned, 'spent', v_spent);
END $$;

-- ============ CHARACTER STATE ============
CREATE OR REPLACE FUNCTION public.get_character_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = v_uid),
    'attributes', public.get_character_attributes(v_uid),
    'coins', public.get_coin_balance(v_uid),
    'class', (SELECT to_jsonb(c) FROM public.character_classes c
              WHERE c.key = (SELECT class_key FROM public.profiles WHERE id = v_uid)),
    'classes', (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.sort_order), '[]'::jsonb) FROM public.character_classes c),
    'purchases', (SELECT COALESCE(jsonb_agg(item_key), '[]'::jsonb) FROM public.shop_purchases WHERE user_id = v_uid),
    'achievements', (SELECT COUNT(*) FROM public.achievements WHERE user_id = v_uid),
    'titles', (SELECT COUNT(*) FROM public.user_titles WHERE user_id = v_uid),
    'missions', (SELECT COUNT(*) FROM public.tasks WHERE user_id = v_uid AND completed = true AND is_template = false),
    'skills', (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.skills s WHERE s.user_id = v_uid)
  );
END $$;

-- ============ BUY ============
CREATE OR REPLACE FUNCTION public.buy_shop_item(p_item_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_item public.shop_items; v_balance int; v_level int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_item FROM public.shop_items WHERE key = p_item_key AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'item indisponível'; END IF;
  IF EXISTS (SELECT 1 FROM public.shop_purchases WHERE user_id = v_uid AND item_key = p_item_key) THEN
    RAISE EXCEPTION 'item já adquirido';
  END IF;
  SELECT COALESCE(level,1) INTO v_level FROM public.profiles WHERE id = v_uid;
  IF v_level < v_item.required_level THEN RAISE EXCEPTION 'nível insuficiente'; END IF;
  v_balance := (public.get_coin_balance(v_uid)->>'balance')::int;
  IF v_balance < v_item.price THEN RAISE EXCEPTION 'fragmentos insuficientes'; END IF;

  INSERT INTO public.shop_purchases(user_id, item_key, price) VALUES (v_uid, p_item_key, v_item.price);
  INSERT INTO public.inventory_items(user_id, item_key, kind, name, description, icon, rarity, metadata)
  VALUES (v_uid, 'shop:'||v_item.key, v_item.kind, v_item.name, v_item.description, v_item.icon, v_item.rarity, v_item.metadata)
  ON CONFLICT DO NOTHING;
  PERFORM public.record_timeline(v_uid, 'shop:'||v_item.key, 'shop',
    'Artefato adquirido: '||v_item.name, v_item.description, v_item.icon,
    jsonb_build_object('rarity', v_item.rarity, 'price', v_item.price));
  RETURN jsonb_build_object('ok', true, 'balance', v_balance - v_item.price);
END $$;

-- ============ CHOOSE CLASS ============
CREATE OR REPLACE FUNCTION public.set_character_class(p_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_class public.character_classes;
  v_attrs jsonb; v_req record; v_have int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_key IS NULL OR p_key = '' THEN
    UPDATE public.profiles SET class_key = NULL, class_chosen_at = NULL, updated_at = now() WHERE id = v_uid;
    RETURN jsonb_build_object('ok', true, 'class', NULL);
  END IF;
  SELECT * INTO v_class FROM public.character_classes WHERE key = p_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'classe inexistente'; END IF;
  v_attrs := public.get_character_attributes(v_uid);
  FOR v_req IN SELECT * FROM jsonb_each_text(v_class.requirements) LOOP
    SELECT COALESCE((a->>'level')::int, 0) INTO v_have
      FROM jsonb_array_elements(v_attrs) a WHERE a->>'key' = v_req.key;
    IF COALESCE(v_have,0) < v_req.value::int THEN RAISE EXCEPTION 'requisitos não cumpridos'; END IF;
  END LOOP;
  UPDATE public.profiles SET class_key = p_key, class_chosen_at = now(), updated_at = now() WHERE id = v_uid;
  PERFORM public.record_timeline(v_uid, 'class:'||p_key, 'class',
    'Classe despertada: '||v_class.name, v_class.tagline, v_class.icon);
  RETURN jsonb_build_object('ok', true, 'class', p_key);
END $$;

-- ============ SEED CLASSES ============
INSERT INTO public.character_classes(key,name,tagline,icon,color,primary_attr,secondary_attr,requirements,perks,sort_order) VALUES
('andarilho','Andarilho','Todo mundo começa em algum lugar.','🧭','slate','disciplina',NULL,'{}','["Acesso a todas as trilhas"]',0),
('guerreiro','Guerreiro','Corpo forjado no ferro.','⚔️','orange','forca','vitalidade','{"forca":4,"vitalidade":3}','["Destaque em treinos","Bônus visual de força"]',1),
('sabio','Sábio','O conhecimento é a arma.','📚','electric','intelecto','disciplina','{"intelecto":4,"disciplina":3}','["Destaque em estudos","Trilha de biblioteca"]',2),
('monge','Monge','Silêncio, foco, constância.','🧘','purple','disciplina','vitalidade','{"disciplina":5,"vitalidade":3}','["Destaque em foco e hábitos"]',3),
('mercador','Mercador','Domínio sobre os recursos.','💎','gold','riqueza','intelecto','{"riqueza":4,"intelecto":2}','["Descontos futuros na loja"]',4),
('alquimista','Alquimista','Transforma caos em rotina.','⚗️','emerald','vitalidade','intelecto','{"vitalidade":4,"intelecto":3}','["Destaque em saúde"]',5)
ON CONFLICT (key) DO NOTHING;

-- ============ SEED SHOP ============
INSERT INTO public.shop_items(key,name,description,icon,kind,rarity,price,required_level,metadata,sort_order) VALUES
('artifact_focus_stone','Pedra do Foco','Artefato lendário dos que não se distraem.','🔮','artifact','rare',150,1,'{}',1),
('artifact_iron_will','Vontade de Ferro','Símbolo de quem nunca quebra a sequência.','🛡️','artifact','epic',400,5,'{}',2),
('artifact_phoenix','Pena da Fênix','Para quem recomeça quantas vezes for preciso.','🪶','artifact','legendary',900,10,'{}',3),
('artifact_time_glass','Ampulheta Eterna','Marca o domínio sobre o próprio tempo.','⏳','artifact','epic',500,8,'{}',4),
('cosmetic_aura_neon','Aura Neon','Brilho elétrico no seu perfil.','🌟','cosmetic','rare',200,3,'{"frame":"neon"}',5),
('cosmetic_aura_gold','Aura Dourada','Um perfil digno de lenda.','👑','cosmetic','legendary',800,15,'{"frame":"gold"}',6),
('boost_double_week','Selo da Semana Dobrada','Marca cosmética de uma semana intensa.','⚡','boost','rare',250,4,'{}',7),
('medal_collector','Medalha do Colecionador','Para quem acumula histórias.','🏵️','medal','epic',350,6,'{}',8),
('artifact_compass','Bússola do Norte','Nunca perca a direção.','🧭','artifact','common',80,1,'{}',9),
('artifact_crown_mind','Coroa da Mente','O ápice do intelecto.','♛','artifact','mythic',1500,20,'{}',10)
ON CONFLICT (key) DO NOTHING;
