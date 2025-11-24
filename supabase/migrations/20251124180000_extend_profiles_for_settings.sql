-- Extend profiles table with settings fields
-- This migration adds fields for user preferences and settings

-- Add new columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS language text DEFAULT 'it',
ADD COLUMN IF NOT EXISTS theme text DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Rome',
ADD COLUMN IF NOT EXISTS date_format text DEFAULT 'DD/MM/YYYY',
ADD COLUMN IF NOT EXISTS email_notifications jsonb DEFAULT '{"new_practice": true, "status_change": true, "new_document": true}'::jsonb;

-- Add check constraints for valid values
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_language_check CHECK (language IN ('it', 'en')),
ADD CONSTRAINT profiles_theme_check CHECK (theme IN ('light', 'dark', 'auto')),
ADD CONSTRAINT profiles_date_format_check CHECK (date_format IN ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_language ON public.profiles(language);
CREATE INDEX IF NOT EXISTS idx_profiles_theme ON public.profiles(theme);

-- Add comment
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL to user avatar/profile picture';
COMMENT ON COLUMN public.profiles.language IS 'User interface language preference (it=Italian, en=English)';
COMMENT ON COLUMN public.profiles.theme IS 'UI theme preference (light, dark, auto)';
COMMENT ON COLUMN public.profiles.timezone IS 'User timezone for date/time display';
COMMENT ON COLUMN public.profiles.date_format IS 'Preferred date format for display';
COMMENT ON COLUMN public.profiles.email_notifications IS 'Email notification preferences (JSON object)';
