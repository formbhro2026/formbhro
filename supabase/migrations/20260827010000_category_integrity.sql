-- Migration: Phase 6E.2 Defect Remediation
-- Add category integrity and policy concurrency triggers.

-- 1. Category Integrity Trigger
CREATE OR REPLACE FUNCTION public.validate_request_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If this is an update and the category didn't change, allow it.
  -- This ensures historical requests with deleted/inactive categories
  -- can still have their status or other fields updated without failing.
  IF TG_OP = 'UPDATE' AND NEW.category = OLD.category THEN
    RETURN NEW;
  END IF;

  -- Verify the new category exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.categories 
    WHERE name = NEW.category AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive category: %', NEW.category;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_category_validity ON public.requests;
CREATE TRIGGER enforce_category_validity
  BEFORE INSERT OR UPDATE OF category ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_request_category();

-- 2. Policy Active-Version Integrity Trigger
CREATE OR REPLACE FUNCTION public.ensure_single_active_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If we are setting a policy to active
  IF NEW.is_active = true THEN
    -- Deactivate all other policies of the exact same type
    UPDATE public.policies
    SET is_active = false
    WHERE type = NEW.type 
      AND id != NEW.id 
      AND is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_active_policy ON public.policies;
CREATE TRIGGER enforce_single_active_policy
  BEFORE INSERT OR UPDATE OF is_active ON public.policies
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.ensure_single_active_policy();
