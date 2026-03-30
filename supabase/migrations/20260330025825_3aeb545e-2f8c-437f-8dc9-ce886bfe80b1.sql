
-- Fix: just add waiter_sessions to realtime (waiter_calls already there)
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_sessions;
