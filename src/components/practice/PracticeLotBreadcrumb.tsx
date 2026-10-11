import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMessages } from "@/i18n";
import { practicesMessages } from "@/i18n/messages/practices";
import { fetchPracticeLots, lotTitle, type PracticeLot } from "@/lib/practiceLots";

interface PracticeLotBreadcrumbProps {
  batchId: string | null;
  practiceId: string;
  practiceNumber: string;
}

/** "Applications › Lot 3 › number", with previous / next inside the lot: a practice never loses its lot. */
export const PracticeLotBreadcrumb = ({ batchId, practiceId, practiceNumber }: PracticeLotBreadcrumbProps) => {
  const m = useMessages(practicesMessages);
  const navigate = useNavigate();
  const [lot, setLot] = useState<PracticeLot | null>(null);
  const [siblings, setSiblings] = useState<Array<{ id: string; practice_number: string }>>([]);

  useEffect(() => {
    setLot(null);
    setSiblings([]);
    if (!batchId) return;
    let cancelled = false;
    void (async () => {
      const [lots, practices] = await Promise.all([
        fetchPracticeLots({ batchIds: [batchId] }).catch(() => []),
        supabase.from("practices").select("id, practice_number").eq("vies_batch_id", batchId).order("practice_number", { ascending: true }).limit(500),
      ]);
      if (cancelled) return;
      setLot(lots[0] ?? null);
      setSiblings(practices.data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  if (!batchId || !lot) return null;

  const index = siblings.findIndex((practice) => practice.id === practiceId);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;
  const title = lotTitle(lot, m.lots.lotName);

  return (
    <nav aria-label={title} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" data-testid="lot-breadcrumb">
      <Link to="/practices" className="hover:text-foreground hover:underline">
        {m.title}
      </Link>
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      <Link to={`/practices?lot=${lot.batchId}`} className="font-medium text-foreground hover:underline" title={lot.representative ?? undefined}>
        {title}
      </Link>
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      <span className="font-mono text-foreground">{practiceNumber}</span>
      {siblings.length > 1 && index >= 0 && (
        <span className="ml-2 inline-flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={!previous} aria-label={previous?.practice_number ?? ""} onClick={() => previous && navigate(`/practices/${previous.id}`)} data-testid="lot-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="tabular-nums">{index + 1} / {siblings.length}</span>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={!next} aria-label={next?.practice_number ?? ""} onClick={() => next && navigate(`/practices/${next.id}`)} data-testid="lot-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </span>
      )}
    </nav>
  );
};
