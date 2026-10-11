import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMessages } from "@/i18n";
import { practicesMessages } from "@/i18n/messages/practices";
import { fetchPracticeLots, lotTitle, type PracticeLot } from "@/lib/practiceLots";
import { cn } from "@/lib/utils";

/** The newest lots are in the menu; "All lots" opens the full list. */
const MENU_LOTS = 8;

interface LotPractice {
  id: string;
  practice_number: string;
  status: string;
}

const STATUS_DOT: Record<string, string> = {
  in_lavorazione: "bg-chart-2",
  in_attesa: "bg-yellow-500",
  integrazioni: "bg-orange-500",
  approvata: "bg-blue-500",
  completata: "bg-green-500",
  rifiutata: "bg-destructive",
};

const PRACTICE_PATH = /^\/practices\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * "Lotti VIES" inside the Practices menu: each lot opens into its practices, each with its own number,
 * and the lot of the practice being viewed is always open, so the user never loses where they are.
 */
export const PracticeLotsMenu = ({ open }: { open: boolean }) => {
  const m = useMessages(practicesMessages).lots;
  const location = useLocation();
  const [lots, setLots] = useState<PracticeLot[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [practicesByLot, setPracticesByLot] = useState<Record<string, LotPractice[] | "loading" | "error">>({});

  const activeLotId = new URLSearchParams(location.search).get("lot");
  const activePracticeId = PRACTICE_PATH.exec(location.pathname)?.[1] ?? null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchPracticeLots({ limit: MENU_LOTS })
      .then((rows) => !cancelled && setLots(rows))
      .catch((error) => console.error("Lots menu:", error));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const loadPractices = useCallback(async (lotId: string) => {
    setPracticesByLot((current) => (current[lotId] && current[lotId] !== "error" ? current : { ...current, [lotId]: "loading" }));
    const { data, error } = await supabase
      .from("practices")
      .select("id, practice_number, status")
      .eq("vies_batch_id", lotId)
      .order("practice_number", { ascending: true })
      .limit(500);
    setPracticesByLot((current) => ({ ...current, [lotId]: error ? "error" : ((data ?? []) as LotPractice[]) }));
  }, []);

  const expand = useCallback(
    (lotId: string) => {
      setExpanded((current) => new Set(current).add(lotId));
      void loadPractices(lotId);
    },
    [loadPractices],
  );

  const toggle = (lotId: string) => {
    if (expanded.has(lotId)) {
      setExpanded((current) => {
        const next = new Set(current);
        next.delete(lotId);
        return next;
      });
    } else {
      expand(lotId);
    }
  };

  // The lot of the practice on screen (or the lot the list is filtered to) is shown open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const reveal = async (lotId: string) => {
      if (cancelled) return;
      expand(lotId);
      // A lot older than the ones in the menu is added, so the context is never missing.
      const known = await fetchPracticeLots({ batchIds: [lotId] }).catch(() => []);
      if (!cancelled && known[0]) setLots((current) => (current.some((lot) => lot.batchId === lotId) ? current : [known[0], ...current]));
    };
    if (activePracticeId) {
      void supabase
        .from("practices")
        .select("vies_batch_id")
        .eq("id", activePracticeId)
        .maybeSingle()
        .then(({ data }) => data?.vies_batch_id && void reveal(data.vies_batch_id));
    } else if (activeLotId) {
      void reveal(activeLotId);
    }
    return () => {
      cancelled = true;
    };
  }, [open, activePracticeId, activeLotId, expand]);

  if (!open || lots.length === 0) return null;

  return (
    <div className="-ml-3 mt-2 border-t border-border pt-2" data-testid="lots-menu">
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{m.menuTitle}</p>
      <div className="space-y-0.5">
        {lots.map((lot) => {
          const isOpen = expanded.has(lot.batchId);
          const items = practicesByLot[lot.batchId];
          const title = lotTitle(lot, m.lotName);
          return (
            <div key={lot.batchId} data-testid="lots-menu-lot">
              <div className="flex items-stretch gap-0.5">
                <button
                  type="button"
                  className="flex w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`${isOpen ? m.collapse : m.expand}: ${title}`}
                  aria-expanded={isOpen}
                  onClick={() => toggle(lot.batchId)}
                >
                  <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
                </button>
                <Link to={`/practices?lot=${lot.batchId}`} className="min-w-0 flex-1" title={lot.representative ?? undefined}>
                  <Button
                    variant={activeLotId === lot.batchId ? "secondary" : "ghost"}
                    size="sm"
                    className="h-auto min-h-8 w-full justify-start whitespace-normal py-1.5 text-left text-[13px] font-normal leading-snug"
                  >
                    <span className="min-w-0 break-words font-medium">{title}</span>
                    <span className="ml-auto shrink-0 pl-2 text-xs tabular-nums text-muted-foreground">{lot.practiceCount}</span>
                  </Button>
                </Link>
              </div>
              {isOpen && (
                <ul role="group" aria-label={title} className="ml-3 mt-0.5 max-h-64 space-y-0.5 overflow-y-auto border-l border-border pl-1">
                  {items === "loading" || items === undefined ? (
                    <li className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {m.loadingPractices}
                    </li>
                  ) : items === "error" || items.length === 0 ? (
                    <li className="px-2 py-1 text-xs text-muted-foreground">{m.noPractices}</li>
                  ) : (
                    items.map((practice) => (
                      <li key={practice.id}>
                        <Link
                          to={`/practices/${practice.id}`}
                          data-testid="lots-menu-practice"
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] tracking-tight hover:bg-accent",
                            activePracticeId === practice.id && "bg-secondary font-medium",
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[practice.status] ?? "bg-muted-foreground")} aria-hidden />
                          <span className="min-w-0 break-all font-mono">{practice.practice_number}</span>
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <Link to="/practices?view=lots" className="mt-1 block px-2 py-1 text-xs text-primary hover:underline">
        {m.allLots}
      </Link>
    </div>
  );
};
