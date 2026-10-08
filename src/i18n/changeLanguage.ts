import { supabase } from "@/integrations/supabase/client";
import { setLanguage, type Language } from "@/i18n";

// Saves the choice on the profile too, so the preference follows the user (and can be
// used for communications); the interface switches immediately either way.
const rememberOnProfile = async (language: Language) => {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (userId) await supabase.from("profiles").update({ language }).eq("id", userId);
  } catch {
    // La lingua resta comunque salvata su questo browser.
  }
};

export const changeLanguage = (language: Language) => {
  setLanguage(language);
  void rememberOnProfile(language);
};
