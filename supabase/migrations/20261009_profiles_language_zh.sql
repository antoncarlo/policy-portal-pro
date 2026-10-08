-- Lingue del portale: italiano, inglese e cinese semplificato.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_language_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_language_check CHECK (language IN ('it', 'en', 'zh'));
