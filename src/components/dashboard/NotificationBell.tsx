import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, useMessages } from "@/i18n";
import { notificationMessages } from "@/i18n/messages/notifications";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string;
  practice_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  practices: { practice_number: string } | null;
}

const LIST_SIZE = 20;
const POLL_MS = 60_000;

/**
 * The portal's own notifications (the database writes one when a practice changes status or gets a document):
 * a bell with the unread count, the latest ones, one click to open the practice and mark it read.
 * The texts follow the language of the person, not the Italian the database stored.
 */
export const NotificationBell = () => {
  const m = useMessages(notificationMessages);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [failed, setFailed] = useState(false);
  // Bumped whenever notifications are marked as read here: a reload asked before that answers with the
  // old count and must not bring the number back on the bell.
  const localChanges = useRef(0);

  const refresh = useCallback(async () => {
    const changesBefore = localChanges.current;
    const [count, list] = await Promise.all([
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false),
      supabase
        .from("notifications")
        .select("id, practice_id, type, title, message, read, created_at, practices(practice_number)")
        .order("created_at", { ascending: false })
        .limit(LIST_SIZE),
    ]);
    if (changesBefore !== localChanges.current) return;
    if (count.error || list.error) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setUnread(count.count ?? 0);
    setItems((list.data ?? []) as unknown as NotificationRow[]);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const markRead = async (id: string) => {
    localChanges.current += 1;
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
    setUnread((current) => Math.max(0, current - 1));
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (error) void refresh();
  };

  const markAll = async () => {
    localChanges.current += 1;
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnread(0);
    const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
    if (error) void refresh();
  };

  const openItem = (item: NotificationRow) => {
    if (!item.read) void markRead(item.id);
    setOpen(false);
    navigate(`/practices/${item.practice_id}`);
  };

  const typeLabel = (type: string) => (type === "document_added" || type === "status_change" ? m.types[type] : m.types.other);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label={m.open(unread)} data-testid="notification-bell">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
              data-testid="notification-count"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={8} className="w-[min(20rem,calc(100vw-1rem))] p-0" data-testid="notification-panel">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">{m.title}</p>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={unread === 0} onClick={() => void markAll()} data-testid="notification-mark-all">
            <CheckCheck className="mr-1 h-3.5 w-3.5" />
            {m.markAll}
          </Button>
        </div>
        <ul className="max-h-96 overflow-y-auto" role="list">
          {failed ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">{m.loadError}</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">{m.empty}</li>
          ) : (
            items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openItem(item)}
                  data-testid="notification-item"
                  data-read={item.read}
                  className={cn("flex w-full items-start gap-2 border-b border-border/60 px-3 py-2 text-left text-sm hover:bg-accent", !item.read && "bg-primary/5")}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-primary")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block", !item.read && "font-medium")}>{typeLabel(item.type)}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{m.practice(item.practices?.practice_number ?? "")}</span>
                    <span className="block text-[11px] text-muted-foreground">{formatDateTime(item.created_at)}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
};
