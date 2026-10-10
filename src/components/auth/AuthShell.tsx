import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Card } from "@/components/ui/card";

/** Cornice delle pagine pubbliche di accesso: logo, selettore di lingua e scheda centrale. */
export const AuthShell = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
    <LanguageSwitcher className="absolute right-4 top-4" />
    <div className="w-full max-w-md">
      <div className="flex items-center justify-center mb-8">
        <img src="/logo.svg" alt="Tecno Advance MGA" className="h-16" />
      </div>
      <Card className="p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        {children}
      </Card>
    </div>
  </div>
);
