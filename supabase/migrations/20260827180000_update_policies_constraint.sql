-- Update policies constraint to allow help and cookie
ALTER TABLE public.policies DROP CONSTRAINT IF EXISTS policies_type_check;
ALTER TABLE public.policies ADD CONSTRAINT policies_type_check CHECK (type IN ('terms', 'privacy', 'delivery', 'help', 'cookie', 'other'));
