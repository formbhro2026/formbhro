-- Migration: Ensure 'Team Direct Report' category is seeded and trigger allows it

INSERT INTO public.categories (name, description, is_active)
VALUES ('Team Direct Report', 'Direct chat between team members and admin', true)
ON CONFLICT (name) DO UPDATE SET is_active = true;

CREATE OR REPLACE FUNCTION public.validate_request_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.category = OLD.category THEN
    RETURN NEW;
  END IF;

  -- Always permit internal direct chat and core categories
  IF NEW.category IN ('Team Direct Report', 'General', 'Other') THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.categories 
    WHERE name = NEW.category AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive category: %', NEW.category;
  END IF;

  RETURN NEW;
END;
$$;
