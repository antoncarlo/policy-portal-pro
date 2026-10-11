import { useState } from "react";
import { format } from "date-fns";
import { Database, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getMessages, useMessages } from "@/i18n";
import { commonMessages } from "@/i18n/messages/common";
import { systemMessages } from "@/i18n/messages/system";
import { fetchAllRows } from "@/lib/fetchAllRows";

const EXPORT_TABLES = ["profiles", "practices", "clients", "practice_documents", "practice_events", "notifications"] as const;

/**
 * A reference copy of the data the signed-in account can see, as JSON. It is not a backup of the database:
 * those are Supabase's (the card says so). The rows are read page by page: the API returns at most 1000.
 */
export const BackupSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const m = useMessages(systemMessages).backup;

  const handleExportData = async () => {
    setLoading(true);
    try {
      const tables: Record<string, unknown[]> = {};
      for (const table of EXPORT_TABLES) {
        tables[table] = await fetchAllRows((from, to) => supabase.from(table).select("*").order("created_at", { ascending: true }).range(from, to));
      }
      const exportData = { export_date: new Date().toISOString(), version: "1.0.0", tables };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${format(new Date(), "yyyyMMdd_HHmmss")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: getMessages(commonMessages).success, description: getMessages(systemMessages).backup.done });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({ variant: "destructive", title: getMessages(commonMessages).error, description: getMessages(systemMessages).backup.failed });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Download className="h-5 w-5" />
          <h2 className="text-xl font-semibold">{m.manual}</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{m.manualText}</p>
        <Button onClick={() => void handleExportData()} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {m.creating}
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              {m.download}
            </>
          )}
        </Button>
      </Card>

      <Card className="bg-muted p-6">
        <div className="mb-2 flex items-center gap-2">
          <Database className="h-5 w-5" />
          <h3 className="font-semibold">{m.dbBackupTitle}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{m.dbBackupText}</p>
      </Card>
    </div>
  );
};
