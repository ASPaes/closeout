-- Add register_number column
ALTER TABLE public.cash_registers ADD COLUMN register_number integer;

-- Create a function to auto-assign register_number per event
CREATE OR REPLACE FUNCTION public.set_cash_register_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next integer;
BEGIN
  IF NEW.register_number IS NULL OR NEW.register_number <= 0 THEN
    SELECT COALESCE(MAX(register_number), 0) + 1 INTO v_next
    FROM public.cash_registers
    WHERE event_id = NEW.event_id;
    NEW.register_number := v_next;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trg_cash_register_number
  BEFORE INSERT ON public.cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cash_register_number();

-- Backfill existing registers
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY opened_at) AS rn
  FROM public.cash_registers
)
UPDATE public.cash_registers cr
SET register_number = n.rn
FROM numbered n
WHERE cr.id = n.id AND cr.register_number IS NULL;

-- Now make it NOT NULL
ALTER TABLE public.cash_registers ALTER COLUMN register_number SET NOT NULL;