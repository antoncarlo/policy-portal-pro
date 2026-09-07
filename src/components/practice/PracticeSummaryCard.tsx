import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, PawPrint, ShieldCheck, Euro, User, FileText, Info } from "lucide-react";
import {
  buildPracticeSummary,
  extractNotesSections,
  type PracticeSummaryInput,
  type SummarySection,
} from "@/lib/practiceSummary";

interface PracticeSummaryCardProps {
  practice: Omit<PracticeSummaryInput, "specific_fields"> & { notes: string | null };
}

const SECTION_ICONS: Record<string, typeof User> = {
  contraente: User,
  polizza: FileText,
  animale: PawPrint,
  coperture: ShieldCheck,
  dati_specifici: ClipboardList,
  premio: Euro,
};

const SectionBlock = ({ section }: { section: SummarySection }) => {
  const Icon = SECTION_ICONS[section.id] ?? Info;
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        {section.title}
      </h3>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {section.items.map((item) => (
          <div key={item.key} className="min-w-0">
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="font-medium text-foreground break-words whitespace-pre-line">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

/**
 * Riepilogo completo della pratica: contraente, polizza, dati specifici della
 * tipologia (con etichette leggibili), coperture Pet e premio.
 */
export const PracticeSummaryCard = ({ practice }: PracticeSummaryCardProps) => {
  const summary = useMemo(() => {
    const { specificFields } = extractNotesSections(practice.notes);
    return buildPracticeSummary({ ...practice, specific_fields: specificFields });
  }, [practice]);

  const pet = summary.pet;
  const hasSpecificData = summary.sections.some((s) => !["contraente", "polizza"].includes(s.id));

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Riepilogo Pratica
          </h2>
          <p className="text-sm text-muted-foreground">
            Tutte le informazioni inserite in fase di quotazione per la polizza {summary.practice_type_label}.
          </p>
        </div>
        {pet && pet.total_annual !== null && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-right">
            <p className="text-xs text-muted-foreground">Premio annuale preventivato</p>
            <p className="text-2xl font-bold text-foreground">
              {pet.total_annual.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
            </p>
            {pet.total_monthly !== null && (
              <p className="text-xs text-muted-foreground">
                {pet.total_monthly.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}/mese
              </p>
            )}
          </div>
        )}
      </div>

      {!hasSpecificData && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Per questa pratica non sono stati ricevuti dati specifici della polizza. Se la pratica arriva da un portale partner,
            verificare che il campo <code className="font-mono">specific_fields</code> venga inviato nella chiamata API.
          </span>
        </div>
      )}

      {pet && pet.coverages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pet.coverages.map((c) => (
            <Badge key={c.id} variant="secondary" className="text-xs">
              {c.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {summary.sections.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}
      </div>
    </Card>
  );
};
