import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LANGUAGES, useLanguage } from "@/i18n";
import { changeLanguage } from "@/i18n/changeLanguage";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  /** "full" mostra il nome della lingua, "compact" solo la sigla. */
  variant?: "full" | "compact";
  align?: "start" | "end";
}

export const LanguageSwitcher = ({ className, variant = "full", align = "end" }: LanguageSwitcherProps) => {
  const language = useLanguage();
  const active = LANGUAGES.find((entry) => entry.code === language) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)} aria-label="Lingua / Language / 语言">
          <Globe className="h-4 w-4 shrink-0" />
          <span>{variant === "full" ? active.label : active.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-40">
        {LANGUAGES.map((entry) => (
          <DropdownMenuItem key={entry.code} onSelect={() => changeLanguage(entry.code)} className="justify-between gap-4">
            <span>{entry.label}</span>
            {entry.code === language && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
