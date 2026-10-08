import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getMessages, useMessages } from "@/i18n";
import { shellMessages } from "@/i18n/messages/shell";
import { commonMessages } from "@/i18n/messages/common";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LoginDialog = ({ open, onOpenChange }: LoginDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const m = useMessages(shellMessages).login;
  const common = useMessages(commonMessages);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    const login = getMessages(shellMessages).login;
    if (error) {
      toast({
        variant: "destructive",
        title: login.errorTitle,
        description: error.message === "Invalid login credentials"
          ? login.invalidCredentials
          : error.message,
      });
    } else {
      toast({
        title: login.successTitle,
        description: login.successDescription,
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <img src="/logo.svg" alt="Tecno Advance MGA" className="h-16" />
          </div>
          <DialogTitle className="text-center">{m.title}</DialogTitle>
          <DialogDescription className="text-center">
            {m.subtitle}
          </DialogDescription>
          <div className="flex justify-center pt-2">
            <LanguageSwitcher align="start" />
          </div>
        </DialogHeader>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{common.email}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={m.emailPlaceholder}
              className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{common.password}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              required
            />
          </div>

          <Button type="submit" className="w-full bg-[#0F3A5C] text-white hover:bg-[#1A4D6F]" disabled={loading}>
            {loading ? m.submitting : m.submit}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
