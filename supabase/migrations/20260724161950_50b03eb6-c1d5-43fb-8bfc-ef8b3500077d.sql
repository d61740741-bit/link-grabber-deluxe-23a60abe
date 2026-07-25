REVOKE EXECUTE ON FUNCTION public.recalculate_xp(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_xp() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalc_xp() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.award_xp(integer, text, public.skill_category) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.award_xp(integer, text, public.skill_category, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._compute_task_xp(uuid, integer, timestamp with time zone) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_xp_after_change() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.recalculate_xp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_xp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp(integer, text, public.skill_category) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp(integer, text, public.skill_category, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_xp(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._compute_task_xp(uuid, integer, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_xp_after_change() TO service_role;