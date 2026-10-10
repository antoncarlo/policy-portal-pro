import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { settingsMessages } from "@/i18n/messages/settings";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";

export const SecuritySettings = () => {
  const { toast } = useToast();
  const m = useMessages(settingsMessages).security;
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false,
  });
  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const validatePassword = (password: string): string | null => {
    if (password.length < 12) {
      return getMessages(settingsMessages).security.tooShort;
    }
    if (!/[A-Z]/.test(password)) {
      return getMessages(settingsMessages).security.needsUppercase;
    }
    if (!/[0-9]/.test(password)) {
      return getMessages(settingsMessages).security.needsNumber;
    }
    return null;
  };

  const handleChangePassword = async () => {
    // Validation
    if (!passwords.newPassword || !passwords.confirmPassword) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: getMessages(settingsMessages).security.fillAll,
      });
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: getMessages(settingsMessages).security.mismatch,
      });
      return;
    }

    const validationError = validatePassword(passwords.newPassword);
    if (validationError) {
      toast({
        variant: "destructive",
        title: getMessages(settingsMessages).security.invalidTitle,
        description: validationError,
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword,
      });

      if (error) throw error;

      toast({
        title: getMessages(commonMessages).success,
        description: getMessages(settingsMessages).security.changed,
      });

      // Reset form
      setPasswords({
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Lock className="h-5 w-5" />
        <h2 className="text-xl font-semibold">{m.title}</h2>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-4">{m.changePassword}</h3>
          <div className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="new_password">{m.newPassword}</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showPasswords.new ? "text" : "password"}
                  value={passwords.newPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, newPassword: e.target.value })
                  }
                  placeholder={m.newPasswordPlaceholder}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() =>
                    setShowPasswords({ ...showPasswords, new: !showPasswords.new })
                  }
                >
                  {showPasswords.new ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {m.rules}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">{m.confirmPassword}</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwords.confirmPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, confirmPassword: e.target.value })
                  }
                  placeholder={m.confirmPasswordPlaceholder}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() =>
                    setShowPasswords({
                      ...showPasswords,
                      confirm: !showPasswords.confirm,
                    })
                  }
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button onClick={handleChangePassword} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {m.change}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
