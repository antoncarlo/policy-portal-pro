import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, useMessages } from "@/i18n";
import { practiceDetailMessages } from "@/i18n/messages/practiceDetail";
import { domainMessages, practiceStatusLabel } from "@/i18n/messages/domain";

// Event descriptions are written in Italian by the database triggers.
const italianStatusKey = (value: string) =>
  Object.entries(domainMessages.it.practiceStatus).find(([key, label]) => key === value || label === value)?.[0] ?? null;

interface Event {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
}

interface PracticeTimelineProps {
  practiceId: string;
}

export const PracticeTimeline = ({ practiceId }: PracticeTimelineProps) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const m = useMessages(practiceDetailMessages).timeline;

  const describe = (description: string) => {
    if (description === "Pratica creata") return m.created;
    if (description === "Nuovo Documento Caricato") return m.newDocument;
    const change = /^Stato cambiato da (.+) a (.+)$/.exec(description);
    if (change) {
      const status = (value: string) => {
        const key = italianStatusKey(value.trim());
        return key ? practiceStatusLabel(key) : value;
      };
      return m.statusChanged(status(change[1]), status(change[2]));
    }
    return description;
  };

  useEffect(() => {
    loadEvents();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`practice-events-${practiceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "practice_events",
          filter: `practice_id=eq.${practiceId}`,
        },
        () => {
          loadEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy loader intentionally runs only for the dependency list below
  }, [practiceId]);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("practice_events")
        .select("*")
        .eq("practice_id", practiceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5" />
        {m.title}
      </h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {m.empty}
        </p>
      ) : (
        <div className="space-y-4">
          {events.map((event, index) => (
            <div key={event.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-primary" />
                {index < events.length - 1 && (
                  <div className="w-0.5 h-full bg-border mt-1" />
                )}
              </div>
              <div className="flex-1 pb-4">
                <p className="text-sm font-medium text-foreground">
                  {describe(event.description)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateTime(event.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
