import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { settingsMessages } from "@/i18n/messages/settings";
import { supabase } from "@/integrations/supabase/client";
import { Monitor, Smartphone, Tablet, LogOut, Loader2, Shield } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * The account's sessions. The browser only knows about its own, so that is what is shown; ending the
 * ones on other devices is done by the authentication service (signOut with scope "others"), not faked.
 */
export const SessionsSettings = () => {
  const { toast } = useToast();
  const m = useMessages(settingsMessages).sessions;
  const [signedInAt, setSignedInAt] = useState<string | null>(null);
  const [showLogoutAll, setShowLogoutAll] = useState(false);
  const [working, setWorking] = useState(false);
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setSignedInAt(data.user?.last_sign_in_at ?? null));
  }, []);

  const getDeviceIcon = (agent: string) => {
    const ua = agent.toLowerCase();
    if (ua.includes("ipad") || ua.includes("tablet")) return <Tablet className="h-5 w-5" />;
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return <Smartphone className="h-5 w-5" />;
    return <Monitor className="h-5 w-5" />;
  };

  const getDeviceName = (agent: string) => {
    const ua = agent.toLowerCase();
    // Edge and Chrome both say "chrome": the more specific names come first.
    if (ua.includes("edg/") || ua.includes("edge")) return "Edge";
    if (ua.includes("firefox")) return "Firefox";
    if (ua.includes("chrome")) return "Chrome";
    if (ua.includes("safari")) return "Safari";
    return m.unknownBrowser;
  };

  const getOS = (agent: string) => {
    const ua = agent.toLowerCase();
    if (ua.includes("windows")) return "Windows";
    if (ua.includes("android")) return "Android";
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "iOS";
    if (ua.includes("mac")) return "macOS";
    if (ua.includes("linux")) return "Linux";
    return m.unknownSystem;
  };

  const run = async (scope: "local" | "others" | "global", done?: () => void) => {
    setWorking(true);
    try {
      const { error } = await supabase.auth.signOut({ scope });
      if (error) throw error;
      if (done) done();
      else window.location.href = "/";
    } catch (error) {
      toast({
        variant: "destructive",
        title: getMessages(commonMessages).error,
        description: error instanceof Error ? error.message : getMessages(settingsMessages).sessions.loadError,
      });
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <Card className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <h2 className="text-xl font-semibold">{m.title}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={working} onClick={() => void run("others", () => toast({ title: getMessages(commonMessages).success, description: getMessages(settingsMessages).sessions.othersEnded }))} data-testid="sessions-end-others">
              {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
              {m.endOthers}
            </Button>
            <Button variant="destructive" size="sm" disabled={working} onClick={() => setShowLogoutAll(true)}>
              <LogOut className="mr-2 h-4 w-4" />
              {m.endAll}
            </Button>
          </div>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">{m.intro}</p>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="rounded-lg bg-muted p-3">{getDeviceIcon(userAgent)}</div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{getDeviceName(userAgent)}</h3>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">{m.current}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getOS(userAgent)} • {m.currentDevice}
                </p>
                {signedInAt && <p className="mt-1 text-xs text-muted-foreground">{m.signedInAt(formatDateTime(signedInAt))}</p>}
              </div>
            </div>
            <Button variant="ghost" size="sm" disabled={working} onClick={() => void run("local")}>
              <LogOut className="mr-2 h-4 w-4" />
              {m.logout}
            </Button>
          </div>
        </Card>

        <div className="mt-6 rounded-lg bg-muted p-4">
          <h3 className="mb-2 font-semibold">{m.tipsTitle}</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {m.tips.map((tip) => (
              <li key={tip}>• {tip}</li>
            ))}
          </ul>
        </div>
      </Card>

      <AlertDialog open={showLogoutAll} onOpenChange={setShowLogoutAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{m.confirmText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void run("global")} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {m.endAll}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
