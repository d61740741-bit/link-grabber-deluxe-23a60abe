
CREATE OR REPLACE FUNCTION public.open_system_box(p_inventory_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_box  public.inventory_items%ROWTYPE;
  v_count int;
  v_rewards jsonb := '[]'::jsonb;
  v_pick record;
  i int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_box FROM public.inventory_items
   WHERE id = p_inventory_id AND user_id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa não encontrada';
  END IF;

  IF position('box_' in v_box.item_key) = 0 THEN
    RAISE EXCEPTION 'Este item não é uma caixa';
  END IF;

  v_count := CASE v_box.rarity
    WHEN 'mythic' THEN 5
    WHEN 'legendary' THEN 4
    WHEN 'epic' THEN 3
    WHEN 'rare' THEN 2
    ELSE 1 END;

  FOR i IN 1..v_count LOOP
    SELECT s.key, s.name, s.description, s.icon, s.kind, s.rarity
      INTO v_pick
      FROM public.shop_items s
     WHERE s.active
       AND s.kind IN ('artifact','relic','boost','cosmetic','medal')
       AND position('box_' in s.key) = 0
     ORDER BY random()
     LIMIT 1;

    IF v_pick.key IS NULL THEN
      EXIT;
    END IF;

    INSERT INTO public.inventory_items (user_id, item_key, kind, name, description, icon, rarity, metadata)
    VALUES (v_user, v_pick.key || '_' || substr(md5(random()::text), 1, 6), v_pick.kind, v_pick.name,
            v_pick.description, v_pick.icon, v_pick.rarity,
            jsonb_build_object('from_box', v_box.item_key));

    v_rewards := v_rewards || jsonb_build_object(
      'key', v_pick.key, 'name', v_pick.name, 'description', v_pick.description,
      'icon', v_pick.icon, 'kind', v_pick.kind, 'rarity', v_pick.rarity);
  END LOOP;

  DELETE FROM public.inventory_items WHERE id = v_box.id;

  PERFORM public.record_timeline(
    v_user, 'box_opened_' || v_box.id::text, 'shop',
    'Caixa aberta: ' || v_box.name,
    jsonb_array_length(v_rewards)::text || ' recompensa(s) materializada(s)',
    '📦', jsonb_build_object('rewards', v_rewards));

  RETURN jsonb_build_object('box', v_box.name, 'rewards', v_rewards);
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_system_box(uuid) TO authenticated;
