import { cn } from "@/lib/utils";
import { PRACTICE_STAGES, type PracticeStage } from "@/lib/practiceStages";
import { usePracticeStageCounts } from "@/hooks/usePracticeStageCounts";
import { useMessages } from "@/i18n";
import { workflowMessages } from "@/i18n/messages/workflow";

interface PracticeStageTabsProps {
  value: PracticeStage | "all";
  onChange: (value: PracticeStage | "all") => void;
}

/** Sections of the practices page: where each practice stands in the flow with the insurer. */
export const PracticeStageTabs = ({ value, onChange }: PracticeStageTabsProps) => {
  const m = useMessages(workflowMessages);
  const { data } = usePracticeStageCounts();
  const entries: Array<{ key: PracticeStage | "all"; label: string; count: number | undefined }> = [
    { key: "all", label: m.stages.all, count: data?.total },
    ...PRACTICE_STAGES.map((stage) => ({ key: stage, label: m.stages[stage], count: data?.counts[stage] })),
  ];

  return (
    <div role="tablist" aria-label={m.tabs.label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {entries.map((entry) => {
        const selected = entry.key === value;
        return (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(entry.key)}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span>{entry.label}</span>
            {entry.count !== undefined && (
              <span
                className={cn(
                  "min-w-6 rounded-full px-1.5 text-center text-xs tabular-nums",
                  selected ? "bg-primary-foreground/20" : "bg-muted text-foreground",
                )}
              >
                {entry.count}
              </span>
            )}
            {entry.key === "deliberata" && !!data?.dueSoon && (
              <span className="rounded-full bg-amber-500/20 px-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400" title={m.tabs.dueSoon(data.dueSoon)}>
                {m.tabs.dueSoon(data.dueSoon)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
