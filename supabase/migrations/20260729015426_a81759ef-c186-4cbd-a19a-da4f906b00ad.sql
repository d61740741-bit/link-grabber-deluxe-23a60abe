ALTER TYPE public.transaction_kind ADD VALUE IF NOT EXISTS 'transferencia';

ALTER TABLE public.finance_transactions
  ADD COLUMN IF NOT EXISTS account text,
  ADD COLUMN IF NOT EXISTS to_account text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS installment_no integer,
  ADD COLUMN IF NOT EXISTS installment_total integer,
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS recurrence_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS finance_tx_user_date_idx ON public.finance_transactions(user_id, occurred_on DESC);

CREATE TABLE IF NOT EXISTS public.finance_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind public.transaction_kind NOT NULL,
  amount numeric NOT NULL,
  category text,
  description text,
  account text,
  to_account text,
  frequency text NOT NULL DEFAULT 'mensal',
  interval_n integer NOT NULL DEFAULT 1,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  until_date date,
  last_generated_date date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_recurrences TO authenticated;
GRANT ALL ON public.finance_recurrences TO service_role;
ALTER TABLE public.finance_recurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own finance_recurrences" ON public.finance_recurrences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.finance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  target_amount numeric NOT NULL,
  current_amount numeric NOT NULL DEFAULT 0,
  deadline date,
  icon text NOT NULL DEFAULT '🎯',
  color text NOT NULL DEFAULT 'gold',
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_goals TO authenticated;
GRANT ALL ON public.finance_goals TO service_role;
ALTER TABLE public.finance_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own finance_goals" ON public.finance_goals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.finance_touch_updated()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_finance_tx_touch ON public.finance_transactions;
CREATE TRIGGER trg_finance_tx_touch BEFORE UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.finance_touch_updated();
DROP TRIGGER IF EXISTS trg_finance_rec_touch ON public.finance_recurrences;
CREATE TRIGGER trg_finance_rec_touch BEFORE UPDATE ON public.finance_recurrences
  FOR EACH ROW EXECUTE FUNCTION public.finance_touch_updated();
DROP TRIGGER IF EXISTS trg_finance_goal_touch ON public.finance_goals;
CREATE TRIGGER trg_finance_goal_touch BEFORE UPDATE ON public.finance_goals
  FOR EACH ROW EXECUTE FUNCTION public.finance_touch_updated();

CREATE OR REPLACE FUNCTION public.generate_recurring_finance()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); r RECORD; v_next date; v_count int := 0; v_step interval;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  FOR r IN SELECT * FROM public.finance_recurrences
           WHERE user_id = v_uid AND active = true
             AND (until_date IS NULL OR until_date >= CURRENT_DATE) LOOP
    v_step := CASE r.frequency
      WHEN 'diaria' THEN make_interval(days => GREATEST(1, r.interval_n))
      WHEN 'semanal' THEN make_interval(weeks => GREATEST(1, r.interval_n))
      WHEN 'anual' THEN make_interval(years => GREATEST(1, r.interval_n))
      ELSE make_interval(months => GREATEST(1, r.interval_n)) END;
    v_next := COALESCE(r.last_generated_date + v_step, r.start_date)::date;
    WHILE v_next <= CURRENT_DATE AND (r.until_date IS NULL OR v_next <= r.until_date) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.finance_transactions
                     WHERE recurrence_id = r.id AND occurred_on = v_next) THEN
        INSERT INTO public.finance_transactions(user_id, kind, amount, category, description, occurred_on, account, to_account, recurrence_id)
        VALUES (v_uid, r.kind, r.amount, r.category, r.description, v_next, r.account, r.to_account, r.id);
        v_count := v_count + 1;
      END IF;
      UPDATE public.finance_recurrences SET last_generated_date = v_next WHERE id = r.id;
      v_next := (v_next + v_step)::date;
    END LOOP;
  END LOOP;
  IF v_count > 0 THEN PERFORM public.recompute_user_xp(v_uid); END IF;
  RETURN v_count;
END $$;
